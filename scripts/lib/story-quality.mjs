/**
 * Shared story-quality rules for all Romance Forge books.
 *
 * Used by:
 *   - scripts/audit-stories.mjs      (full read-only audit report)
 *   - scripts/clean-story.mjs        (mechanical strip: padding, meta, renames)
 *   - tests/story-quality.test.js    (CI guardrail: fails on padding / meta / old names / broken labels)
 *
 * META_TERMS is the hand-checked list from the 2026-09-24 audit: planning / craft
 * jargon that must never reach reader-visible text (scene prose, titles are exempt,
 * choice labels are not). "verb" is handled separately: it is only a leak in
 * narration (the "choice-as-verb" tic); inside quoted dialogue it is allowed.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const STORY_IDS = ["until-the-quiet-breaks", "what-the-sister-kept", "the-living-key", "the-soft-alibi"];

// ---------------------------------------------------------------- text helpers
const WORD_RE = /[A-Za-z0-9\[\]_’'-]+/g;
export function words(s) { return String(s || "").match(WORD_RE) || []; }
export function wc(s) { return words(s).length; }
export function normWords(s) {
  return words(String(s || "").toLowerCase().replace(/\[player_name\]/g, " pn ").replace(/[’‘]/g, "'").replace(/\d+/g, "#"))
    .map((w) => w.replace(/^['-]+|['-]+$/g, "")).filter(Boolean);
}
export function splitParagraphs(text) { return String(text || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean); }
/** Sentence split that keeps punctuation / closing quotes and ignores Mr./Dr. etc. */
export function splitSentences(p) {
  return String(p).replace(/\b(Mr|Mrs|Ms|Dr|St|Capt|Det|Sgt)\. /g, "$1\u00a7 ")
    .split(/(?<=[.!?…][”"’)*]*)\s+(?=["“‘(*\[]?[A-Z\[])/)
    .map((s) => s.replace(/\u00a7/g, ".")).filter((s) => s.trim().length);
}
export function shingles(ws, k = 3) {
  const out = new Set();
  if (ws.length < k) { out.add(ws.join(" ")); return out; }
  for (let i = 0; i + k <= ws.length; i++) out.add(ws.slice(i, i + k).join(" "));
  return out;
}
export function jaccard(a, b) {
  let inter = 0;
  const [s, l] = a.size < b.size ? [a, b] : [b, a];
  for (const x of s) if (l.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Narration-only view of each sentence in a paragraph: quoted dialogue
 * ("…" or “…”) is blanked. Returns [{ sentence, narration }].
 */
export function sentencesWithNarration(p) {
  const out = [];
  let inside = false;
  for (const s of splitSentences(p)) {
    let narr = "";
    for (const ch of s) {
      if (ch === "“") { inside = true; narr += " "; continue; }
      if (ch === "”") { inside = false; narr += " "; continue; }
      if (ch === '"') { inside = !inside; narr += " "; continue; }
      narr += inside ? " " : ch;
    }
    out.push({ sentence: s, narration: narr });
  }
  return out;
}

// ---------------------------------------------------------------- meta terms
export const META_TERMS = [
  /\blayers? ?\d+\b/i, /\bLayer\b/, /\bL\d{1,2}\b/, /\bscene ?\d+[a-p]?\b/i,
  /\bchoice labels?\b/i, /\bchoice (?:tree|ids?|points?|screen|buttons?|verbs?)\b/i,
  /\bverbs? of consequence\b/i, /\bconsequence[- ]verbs?\b/i, /\bconsequential verbs?\b/i,
  /\bmid-want\b/i, /\bintimacy[- ]forward\b/i, /\bPOV\b/, /\bLI\b/, /\blove interest\b/i, /\bprotagonist\b/i,
  /\bsmut\b/i, /\bBookTok\b/i, /\bspice (?:level|tier)\b/i, /\bspicy\b/i, /\breaders?\b/i, /\bplayers?\b(?!_name)/i,
  /\bprompts?\b/i, /\bpremise\b/i, /\bspec\b/i, /\btextHot\b/,
  /(?:(?<=[a-z,;:—] )|(?<=—))(?:Warm|Hot)\b(?! (?:water|breath|mouth|skin|coffee|tea|shower|light|air|hands?|wine|wax|metal|iron|stone|tears)\b)/,
  /\b(?:Warm|Hot)[- ](?:honest|honesty|register|mode|path|text|version|tier|track|spice|lane|craft|ending)\b/,
  /\bgore\b/i, /\bcosplay\b/i, /\bsex (?:was not|is not|was never)\b/i, /\bsex stayed (?!good\b)/i, /\bconsent stayed\b/i,
  /\bhinge held\b/i, /\b(?:stood|stand|standing|stay(?:ed)?|live[ds]?|lived) (?:slick |wet )?in the hinge\b/i, /\bhinge of (?:mid-want|wanting|choice|scene)/i,
  /\bexits? (?:demanded|waited)\b/i, /\bchoose before climax\b/i,
  /\bambiguity lock/i, /\bambiguity locked\b/i, /\block (?:held|stayed)\b/i, /\bromance[- ]lock/i, /\bromance locked\b/i,
  /\bpayoff\b/i, /\bthrough-line\b/i, /\bgarnish\b/i, /\bobsession-grade\b/i, /\bunderplot\b/i, /\bbody-true\b/i,
  /\bhook (?:as craft|ending)\b/i, /\bthe hook (?:set|sat|hung|held|was)\b/i, /\bevery scene\b/i, /\bscene's weather\b/i,
  /\bcraft (?:bar|of (?:this|the) (?:night|morning|ending))\b/i, /\bfilthy craft\b/i, /\bmid-want craft\b/i,
  /\b(?:was|stayed|had been|became) (?:the )?plot\b/i, /\bplot's engine\b/i, /\badvanced the plot\b/i, /\bthe plot (?:gets|paid)\b/i, /\bplot under the plot\b/i,
  /\b(?:other|this) branch(?:es)?\b/i, /\b(?:this|that) ending\b/i, /\bchapter where\b/i,
  /\bin the sentence\b/i, /\bslow[- ]burn\b/i, /\btropes?\b/i, /\bfade[- ]to[- ]black\b/i, /\bon[- ]page\b/i, /\bword (?:count|minimum)s?\b/i,
  /\bIP[- ]lock\b/i, /\bcanon\b/i, /\bunfinished on purpose\b/i, /\bending on purpose\b/i, /\b(?:four|all) fates\b/i,
  /\bheat advanced\b/i, /\bsoft-land(?:ed|s)? the scene\b/i, /\bhints? only\b/i,
  /\bspice nor\b/i, /\bneither spice\b/i, /\binto one hook\b/i, /\bas plot\b/i, /\bsex as trust\b/i, /\bmystery texture\b/i,
  /\beroticized corpse\b/i, /\b(?:hung|hangs|hanging) as (?:the )?hook\b/i, /\bhook craft\b/i, /\ba hook, not a landing\b/i,
];

/**
 * Ending titles used as nouns in prose ("Quiet Resealed was bitter sex…",
 * "that was Leave Free in the Hot register") are meta. Built per story from the
 * last-layer scene titles (text before " — "); matched case-sensitively.
 */
export function endingNamePatterns(scenes) {
  const maxLayer = Math.max(...scenes.map((s) => s.layer || 0));
  return scenes.filter((s) => s.layer === maxLayer && s.title)
    .map((s) => s.title.split(/\s+[—–-]\s+|:/)[0].trim())
    .filter((n) => n.split(/\s+/).length >= 2)
    .map((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`));
}
/** "verb" talk in narration = the choice-mechanics tic. Allowed inside dialogue. */
export const VERB_RE = /\bverbs?\b/i;

/**
 * allow: [{ story?, text }] — explicit false-positive allowlist (sentence
 * substrings). The CI test keeps its own list in tests/story-quality.test.js.
 */
function allowed(storyId, sentence, allow = []) {
  return allow.some((a) => (!a.story || a.story === storyId) && sentence.includes(a.text));
}

/** Meta hits in one prose text. Returns [{ sentence, term, kind }]. extra = more regexes (e.g. endingNamePatterns). */
export function findMetaHits(text, storyId = "", extra = [], allow = []) {
  const hits = [];
  for (const p of splitParagraphs(text)) {
    for (const { sentence, narration } of sentencesWithNarration(p)) {
      if (allowed(storyId, sentence, allow)) continue;
      const s2 = sentence.replace(/\[player_name\]/g, "");
      const m = META_TERMS.find((re) => re.test(s2)) || extra.find((re) => re.test(s2));
      if (m) { hits.push({ sentence, term: s2.match(m)[0], kind: "meta" }); continue; }
      if (VERB_RE.test(narration)) hits.push({ sentence, term: narration.match(VERB_RE)[0], kind: "verb" });
    }
  }
  return hits;
}

/** Meta terms in a choice label (verbs count here too: labels are narration). */
export function findLabelMeta(label, storyId = "", extra = [], allow = []) {
  if (!label || allowed(storyId, label, allow)) return [];
  const s2 = label.replace(/\[player_name\]/g, "");
  const out = [...META_TERMS, ...extra].filter((re) => re.test(s2)).map((re) => s2.match(re)[0]);
  if (VERB_RE.test(s2)) out.push(s2.match(VERB_RE)[0]);
  return out;
}

/** Truncated / malformed label: unbalanced brackets or quotes, or ends on a dangling fragment. */
export function isTruncatedLabel(label) {
  const t = String(label || "").trim();
  if (!t) return true;
  const count = (re) => (t.match(re) || []).length;
  if (count(/\(/g) !== count(/\)/g)) return true;
  if (count(/\[/g) !== count(/\]/g) + 0 && !/\[player_name\]/.test(t)) return true;
  if (count(/"/g) % 2) return true;
  if (count(/“/g) !== count(/”/g)) return true;
  if (/[,;:(—–-]\s*[a-z]?$/.test(t)) return true;
  return false;
}

// ---------------------------------------------------------------- names
export const OLD_NAMES = [/\bLane Shaw\b/, /\bJake Shaw\b/, /\bJake Akers\b/, /\bJake\b/];
export function findOldNames(text) {
  const out = [];
  for (const p of splitParagraphs(text)) for (const s of splitSentences(p)) {
    const r = OLD_NAMES.find((re) => re.test(s));
    if (r) out.push({ sentence: s, term: s.match(r)[0] });
  }
  return out;
}

// ---------------------------------------------------------------- padding
/**
 * Repeated-paragraph padding for one field ("text" | "textHot") across a story.
 * A paragraph (>= paraMinWords) is padding if a near-duplicate (word-3-gram
 * Jaccard >= sim, numbers / [player_name] normalized) appears in minScenes+
 * scenes; 2nd+ copies of a paragraph inside the same scene are padding too.
 * Returns { perScene: { [id]: { total, repeated, pct } }, clusters, padKeys }.
 * padKeys: Set of `${sceneId}#${paragraphIndex}` that are padding.
 */
export function repeatedPadding(scenes, field, { minScenes = 3, paraMinWords = 12, sim = 0.75, intraMinWords = 8 } = {}) {
  const paras = [];
  for (const sc of scenes) splitParagraphs(sc[field]).forEach((p, idx) => {
    const nw = normWords(p);
    if (nw.length >= paraMinWords) paras.push({ sid: sc.id, idx, raw: p, nw, key: nw.join(" "), sh: shingles(nw) });
  });
  const parent = paras.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
  const inv = new Map();
  paras.forEach((p, i) => { for (const s of p.sh) { if (!inv.has(s)) inv.set(s, []); inv.get(s).push(i); } });
  paras.forEach((p, i) => {
    const cnt = new Map();
    for (const s of p.sh) for (const j of inv.get(s)) if (j > i) cnt.set(j, (cnt.get(j) || 0) + 1);
    for (const [j, c] of cnt) if (c / (p.sh.size + paras[j].sh.size - c) >= sim) union(i, j);
  });
  const groups = new Map();
  paras.forEach((p, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(p); });
  const padKeys = new Set();
  const clusters = [];
  for (const members of groups.values()) {
    const sids = new Set(members.map((m) => m.sid));
    if (sids.size >= minScenes) {
      members.forEach((m) => padKeys.add(`${m.sid}#${m.idx}`));
      clusters.push({ scenes: [...sids], occurrences: members.length, words: members[0].nw.length, sample: members[0].raw });
    }
  }
  const perScene = {};
  for (const sc of scenes) {
    let total = 0, repeated = 0;
    const seen = [];
    splitParagraphs(sc[field]).forEach((p, idx) => {
      const n = wc(p);
      total += n;
      if (padKeys.has(`${sc.id}#${idx}`)) { repeated += n; return; }
      const nw = normWords(p);
      if (nw.length < intraMinWords) return;
      const sh = shingles(nw);
      if (seen.some((q) => jaccard(q, sh) >= sim)) { repeated += n; padKeys.add(`${sc.id}#${idx}`); return; }
      seen.push(sh);
    });
    perScene[sc.id] = { total, repeated, pct: total ? (100 * repeated) / total : 0 };
  }
  return { perScene, clusters, padKeys };
}

// ---------------------------------------------------------------- loading
export async function loadStoryScenes(root, storyId) {
  const dir = path.join(root, "artifacts/stories", storyId, "scenes");
  const files = fs.readdirSync(dir).filter((f) => /^scene.*\.js$/.test(f));
  const scenes = [];
  for (const f of files) {
    const mod = await import(pathToFileURL(path.join(dir, f)).href + `?t=${Date.now()}${Math.random()}`);
    scenes.push({ file: f, ...mod.default });
  }
  scenes.sort((a, b) => (a.layer - b.layer) || String(a.id).localeCompare(String(b.id), "en", { numeric: true }));
  return scenes;
}

/**
 * Replace the value of a top-level `  <key>: ...` string field in a scene
 * module's source. Supports both template literals (`...`) and JSON-style
 * double-quoted strings ("..."), preserving whichever style the file uses.
 */
export function replaceSceneField(src, key, value) {
  const marker = `\n  ${key}: `;
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`no ${key} field`);
  const q = src[start + marker.length];
  if (q !== "`" && q !== '"') throw new Error(`${key}: unsupported literal ${q}`);
  const bodyStart = start + marker.length + 1;
  let i = bodyStart;
  while (i < src.length) {
    if (src[i] === "\\") { i += 2; continue; }
    if (src[i] === q) break;
    i++;
  }
  if (i >= src.length) throw new Error(`unterminated ${key} literal`);
  const body = q === "`"
    ? value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${")
    : JSON.stringify(value).slice(1, -1);
  return src.slice(0, bodyStart) + body + src.slice(i);
}
