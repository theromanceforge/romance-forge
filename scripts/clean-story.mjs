#!/usr/bin/env node
/**
 * Mechanical cleanup for any Romance Forge story (adapted from
 * scripts/strip-soft-alibi-padding.mjs). Never writes new prose.
 *
 *   node scripts/clean-story.mjs <storyId> [--pad-layers 4-9] [--no-pad] [--sent-pad] [--check] [--report out.json]
 *
 * Per scene, both `text` (Warm) and `textHot` (Hot):
 *   1. renames   — story-specific old-name fixes (e.g. Jake → John / Will);
 *   2. dedupe    — 2nd+ copies of a paragraph (near-duplicate) inside one scene;
 *   3. padding   — paragraphs repeated (near-duplicate) in 3+ scenes, plus long
 *                  (20+ word) sentences repeated in 3+ scenes (only with
 *                  --sent-pad), removed from scenes in --pad-layers (default: all);
 *   4. meta      — planning/craft sentences (scripts/lib/story-quality.mjs
 *                  META_TERMS, plus "verb" talk in narration). Jargon nouns are
 *                  swapped for the plain word ("mid-want" → "want"); a meta
 *                  clause after a dash / semicolon / colon is trimmed when the
 *                  main clause is clean; otherwise the sentence is removed.
 *                  Dialogue quote marks are re-balanced after removals.
 * IDs, titles, layers and choices are untouched. Idempotent.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  META_TERMS, VERB_RE, splitParagraphs, splitSentences, normWords, shingles, jaccard, wc,
  repeatedPadding, loadStoryScenes, replaceSceneField, findMetaHits, endingNamePatterns,
} from "./lib/story-quality.mjs";
let EXTRA = [];

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const storyId = args.find((a) => !a.startsWith("--") && !/^\d/.test(a));
const flag = (n) => args.includes(n);
const optv = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
if (!storyId) { console.error("usage: clean-story.mjs <storyId> [--pad-layers 4-9] [--no-pad] [--check] [--report f]"); process.exit(2); }
const CHECK = flag("--check");
const NO_PAD = flag("--no-pad");
const SENT_PAD = flag("--sent-pad"); // also strip 20+ word sentences repeated in 3+ scenes
const padRange = optv("--pad-layers");
const [padLo, padHi] = padRange ? padRange.split("-").map(Number) : [1, 99];

const RENAMES = {
  "until-the-quiet-breaks": [[/\bJake Shaw\b/g, "John Shaw"], [/\bJake's\b/g, "John's"], [/\bJake\b/g, "John"]],
  "what-the-sister-kept": [[/\bJake Akers\b/g, "William Akers"], [/\bDetective Jake\b/g, "Detective William"], [/\bJake's\b/g, "Will's"], [/\bJake\b/g, "Will"]],
};

// ------------------------------------------------------------ jargon swaps
// Applied only to sentences that contain a meta term; each swap deletes or
// replaces a jargon word with the plain word it stood for (no new content).
const SWAPS = [
  [/\bmid-want, mid-war,\s*/g, ""], [/,\s*mid-want, mid-war(?=[,.;—])/g, ""], [/\bmid-want, (?=mid-)/g, ""],
  [/,\s*mid-want(?=[,.;—])/g, ""], [/\bboth mid-want\b/g, "both wanting"], [/\bmid-want honesty\b/g, "honest want"],
  [/\bmid-want (detective|man|woman|lover|body)\b/g, "wanting $1"], [/\bmid-want slick\b/g, "slick with want"],
  [/\bmid-want (shameless|filthy|inappropriate|mercy|survival)\b/g, "$1"], [/\bmid-case\b/g, "case"],
  [/\bthe mid-want echo of\b/g, "the echo of"], [/\bthe mid-want echo\b/g, "the echo of want"], [/\bThe mid-want echo\b/g, "The echo of want"],
  [/\bmid-want echo(e[ds])?\b/g, "want echo$1"],
  [/\ba mid-want (pulse|ache|throb|hum|flush|heat)\b/g, "a $1 of want"],
  [/\bmid-(?:refusal|pride|ruin|mercy)\b/g, (m) => m.slice(4)],
  [/\bMid-want(?! (?:endings?|exits?|craft|first|filed|locked)\b)/g, "Want"],
  [/\bmid-want(?! (?:endings?|exits?|craft|first|filed|locked)\b)/g, "want"],
  [/\s*in body-POV(?=[:,.;])/g, ""], [/\bbody-POV /g, ""], [/,?\s*body-POV loud\b/g, ""],
  [/(?:,|—)\s*not gore(?:-porn)?(?=[,.;—])/gi, ""], [/(?:,|—)\s*not violence cosplay(?=[,.;—])/gi, ""],
  [/(?:,|—)\s*no gore(?:-porn)?(?=[,.;—])/gi, ""],
  [/—hook as craft, denial as pressure/g, ""], [/,\s*hook as craft(?=[,.;—])/g, ""],
  [/\bWarm-honest\b/g, "honest"],
  [/,\s*unfinished on purpose(?=[,.])/g, ""], [/\s+unfinished on purpose(?=[,.])/g, " unfinished"],
  [/\bsecond-LI\b/g, "second"],
  [/ like a hook craft refused to remove\b/g, " like a hook"],
  [/,\s*denial as craft(?=[.,;])/g, ""], [/\b([Tt]he|a) plot turn\b/g, "$1 turn"],
  [/,\s*denied (finish|center kiss) hanging as hook\b/g, ", the $1 denied"],
];

// Human-checked false positives; mirror of ALLOW in tests/story-quality.test.js.
const KEEP = [
  "without asking what was under the garnish", // Quiet Breaks 4c: plate metaphor, not craft talk
];

function hasMeta(s, narration = s) {
  if (KEEP.some((k) => s.includes(k))) return false;
  const s2 = s.replace(/\[player_name\]/g, "");
  return META_TERMS.some((re) => re.test(s2)) || EXTRA.some((re) => re.test(s2)) || VERB_RE.test(narration);
}
function narrationOf(s) {
  let inside = false, out = "";
  for (const ch of s) {
    if (ch === "“") { inside = true; out += " "; continue; }
    if (ch === "”") { inside = false; out += " "; continue; }
    if (ch === '"') { inside = !inside; out += " "; continue; }
    out += inside ? " " : ch;
  }
  return out;
}

/** Clean one sentence given its narration view. Returns { out: string|null, action }. */
function cleanSentence(sentence, narration) {
  if (!hasMeta(sentence, narration)) return { out: sentence, action: "keep" };
  let s = sentence;
  for (const [re, rep] of SWAPS) s = s.replace(re, rep);
  s = s.replace(/\s{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1");
  const quotesChanged = (s.match(/["“”]/g) || []).length !== (sentence.match(/["“”]/g) || []).length;
  if (!quotesChanged && !hasMeta(s, narrationOf(s)) && wc(s) >= 3) return { out: s, action: "swap" };
  // clause trim on — ; : (only if the removed part has no quote marks)
  const term = s.match(/([.!?…]+[”"’)*]*|[”"’)*]+)$/);
  const tail = term ? term[0] : "";
  const body = tail ? s.slice(0, -tail.length) : s;
  const parts = body.split(/(—|; |: )/);
  const segs = [];
  for (let i = 0; i < parts.length; i += 2) segs.push({ delim: i ? parts[i - 1] : "", text: parts[i] });
  const isM = (g) => hasMeta(g.text, narrationOf(g.text));
  if (segs.length > 1 && !isM(segs[0])) {
    const k = segs.findIndex(isM);
    let kept = null;
    // dash-enclosed aside "A—meta—C…" (rest clean, C not a new sentence): drop the aside and both dashes
    if (segs[k].delim === "—" && segs[k + 1] && segs[k + 1].delim === "—" && !segs.slice(k + 1).some(isM) && /^\s*(?:[a-z]|\[player_name\])/.test(segs[k + 1].text)) {
      const head = segs.slice(0, k).map((g) => g.delim + g.text).join("");
      // "A—C" keeps the dash; only a bare subject ("Nina Solis—meta—made…") is joined with a space
      kept = [...segs.slice(0, k), { delim: wc(head) <= 3 ? " " : "—", text: segs[k + 1].text.replace(/^\s+/, "") }, ...segs.slice(k + 2)];
    } else {
      kept = segs.slice(0, k); // truncate at the first meta clause
    }
    const removed = segs.filter((g) => !kept.includes(g));
    if (!removed.some((g) => /["“”]/.test(g.text))) {
      let out = kept.map((g) => g.delim + g.text).join("").replace(/[,;:—\s]+$/, "") + (tail || ".");
      if (!/[.!?…]/.test(tail)) out = out.replace(/([”"’)*]*)$/, ".$1");
      // a trim inside a parenthetical must still close it
      const open = (out.match(/\(/g) || []).length - (out.match(/\)/g) || []).length;
      if (open > 0) out = out.replace(/([.!?…]+[”"’*]*)$/, ")".repeat(open) + "$1");
      if (!hasMeta(out, narrationOf(out)) && wc(out) >= 4) return { out, action: "trim" };
    }
  }
  return { out: null, action: "drop" };
}

/** Clean a paragraph: sentence-level meta removal with dialogue-quote repair. */
function cleanParagraph(p, log) {
  const curly = /[“”]/.test(p);
  const OPEN = curly ? "“" : '"', CLOSE = curly ? "”" : '"';
  const sents = splitSentences(p);
  let inside = false; // original dialogue state
  let cur = false; // new text dialogue state
  const kept = [];
  for (const s of sents) {
    const startInside = inside;
    let narr = "", st = inside;
    for (const ch of s) {
      if (ch === "“") { st = true; narr += " "; continue; }
      if (ch === "”") { st = false; narr += " "; continue; }
      if (ch === '"') { st = !st; narr += " "; continue; }
      narr += st ? " " : ch;
    }
    const endInside = st;
    inside = endInside;
    // narration for a sentence that starts inside dialogue: already handled by st
    const r = cleanSentence(s, narr);
    if (r.action !== "keep") log.push({ action: r.action, before: s, after: r.out });
    if (r.out === null) continue;
    let out = r.out;
    if (startInside && !cur) out = OPEN + out;
    if (!startInside && cur && kept.length) kept[kept.length - 1] += CLOSE;
    kept.push(out);
    cur = endInside;
  }
  if (cur && !inside && kept.length) kept[kept.length - 1] += CLOSE;
  return kept.join(" ").trim();
}

// ------------------------------------------------------------ main
const scenes = await loadStoryScenes(ROOT, storyId);
EXTRA = endingNamePatterns(scenes);
const state = scenes.map((sc) => ({ sc, text: sc.text || "", textHot: sc.textHot || "", log: { text: [], textHot: [] }, stats: { text: {}, textHot: {} } }));
const inPad = (sc) => !NO_PAD && sc.layer >= padLo && sc.layer <= padHi;

for (const f of ["text", "textHot"]) {
  // 1. renames
  const ren = RENAMES[storyId] || [];
  for (const st of state) {
    let t = st[f];
    const before = (t.match(/\bJake\b/g) || []).length;
    for (const [re, rep] of ren) t = t.replace(re, rep);
    st.stats[f].renamed = before - (t.match(/\bJake\b/g) || []).length;
    st[f] = t;
  }
  // 2+3. padding: cross-scene clusters (3+ scenes) + intra-scene duplicate paragraphs
  const pad = repeatedPadding(state.map((st) => ({ id: st.sc.id, [f]: st[f] })), f);
  // long repeated sentences (20+ words, 3+ scenes, exact after normalization)
  const sentScenes = new Map();
  for (const st of state) {
    const seen = new Set();
    for (const p of splitParagraphs(st[f])) for (const s of splitSentences(p)) {
      const nw = normWords(s);
      if (nw.length < 20) continue;
      const k = nw.join(" ");
      if (!seen.has(k)) { seen.add(k); sentScenes.set(k, (sentScenes.get(k) || 0) + 1); }
    }
  }
  for (const st of state) {
    const paras = splitParagraphs(st[f]);
    let removedWords = 0, dedupWords = 0;
    const seenSh = [];
    const keptParas = [];
    paras.forEach((p, idx) => {
      const nw = normWords(p);
      const isCross = pad.clusters.length && pad.padKeys.has(`${st.sc.id}#${idx}`);
      // intra-scene duplicate check (always applied: it's never intentional)
      if (nw.length >= 8) {
        const sh = shingles(nw);
        if (seenSh.some((q) => jaccard(q, sh) >= 0.75)) { dedupWords += wc(p); return; }
        seenSh.push(sh);
      }
      if (isCross && inPad(st.sc)) {
        // cross-scene padding (padKeys also marks intra copies, handled above)
        removedWords += wc(p); return;
      }
      keptParas.push(p);
    });
    // repeated long sentences inside kept paragraphs (padding layers only)
    const out = [];
    const seenSent = new Set();
    for (const p of keptParas) {
      const ks = [];
      for (const s of splitSentences(p)) {
        const k = normWords(s).join(" ");
        if (normWords(s).length >= 10 && seenSent.has(k) && !/["“”]/.test(s)) { dedupWords += wc(s); continue; }
        seenSent.add(k);
        if (SENT_PAD && inPad(st.sc) && normWords(s).length >= 20 && (sentScenes.get(k) || 0) >= 3 && !/["“”]/.test(s)) { removedWords += wc(s); continue; }
        ks.push(s);
      }
      if (ks.length) out.push(ks.join(" "));
    }
    st.stats[f].padWords = removedWords;
    st.stats[f].dedupWords = dedupWords;
    st[f] = out.join("\n\n");
  }
  // 4. meta
  for (const st of state) {
    const before = wc(st[f]);
    const paras = splitParagraphs(st[f]).map((p) => cleanParagraph(p, st.log[f])).filter(Boolean);
    st[f] = paras.join("\n\n");
    st.stats[f].metaWords = before - wc(st[f]);
  }
}

// ------------------------------------------------------------ write + report
let changed = 0;
const totals = { renamed: 0, padWords: 0, dedupWords: 0, metaWords: 0, dropped: 0, trimmed: 0, swapped: 0 };
const flags = [];
for (const st of state) {
  const didChange = st.text !== (st.sc.text || "") || st.textHot !== (st.sc.textHot || "");
  for (const f of ["text", "textHot"]) {
    for (const k of ["renamed", "padWords", "dedupWords", "metaWords"]) totals[k] += st.stats[f][k] || 0;
    for (const l of st.log[f]) totals[{ drop: "dropped", trim: "trimmed", swap: "swapped" }[l.action]]++;
    if (!st[f].trim()) flags.push(`${st.sc.id} ${f}: EMPTY`);
    const left = findMetaHits(st[f], storyId, EXTRA, KEEP.map((text) => ({ text })));
    if (left.length) flags.push(`${st.sc.id} ${f}: ${left.length} meta left, e.g. "${left[0].sentence.slice(0, 100)}"`);
    const qs = (st[f].match(/"/g) || []).length;
    if (qs % 2) flags.push(`${st.sc.id} ${f}: odd straight-quote count`);
    if ((st[f].match(/“/g) || []).length !== (st[f].match(/”/g) || []).length) flags.push(`${st.sc.id} ${f}: unbalanced curly quotes`);
  }
  if (!didChange) continue;
  changed++;
  if (CHECK) continue;
  const file = path.join(ROOT, "artifacts/stories", storyId, "scenes", st.sc.file);
  let src = fs.readFileSync(file, "utf8");
  src = replaceSceneField(src, "textHot", st.textHot);
  src = replaceSceneField(src, "text", st.text);
  fs.writeFileSync(file, src);
}
if (!CHECK) {
  const back = await loadStoryScenes(ROOT, storyId);
  for (const st of state) {
    const b = back.find((x) => x.id === st.sc.id);
    const strip = (o) => JSON.stringify({ ...o, text: 0, textHot: 0 });
    if (!b || b.text !== st.text || b.textHot !== st.textHot || strip(b) !== strip(st.sc)) { console.error("VERIFY FAILED", st.sc.id); process.exit(1); }
  }
}
console.log(`${storyId}: scenes changed ${changed}/${state.length}${CHECK ? " (check mode)" : ""}`);
console.log(JSON.stringify(totals));
if (flags.length) { console.log(`flags (${flags.length}):`); flags.forEach((f) => console.log(" - " + f)); }
const rep = optv("--report");
if (rep) fs.writeFileSync(rep, JSON.stringify(state.map((st) => ({ id: st.sc.id, layer: st.sc.layer, stats: st.stats, log: st.log, words: { before: { text: wc(st.sc.text), textHot: wc(st.sc.textHot) }, after: { text: wc(st.text), textHot: wc(st.textHot) } } })), null, 2));
