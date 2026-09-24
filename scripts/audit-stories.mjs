#!/usr/bin/env node
/**
 * Romance Forge — read-only story quality audit.
 *
 * Usage:
 *   node scripts/audit-stories.mjs [storyId[:layers]] ... [--root DIR] [--json FILE] [--md FILE]
 *     storyId:layers  e.g. the-soft-alibi:1,10  (report only those layers; repeat
 *                     detection still uses the whole story as corpus)
 *   default: all stories under artifacts/stories
 *
 * Checks (Warm `text` and Hot `textHot` audited separately):
 *  1. Repeated padding — paragraphs (>=12 words) and sentences (>=20 words) that
 *     recur verbatim / near-verbatim (numbers, [player_name], punctuation, case
 *     normalized; paragraphs clustered at >=0.75 word-3-gram Jaccard) in 3+ scenes.
 *     Per scene: % of words inside such repeats. Also a 10-gram "shingle coverage"
 *     signal (words covered by any 10-word run found in 3+ scenes).
 *  2. Meta/planning leaks — regexes over reader-visible prose (text/textHot), plus
 *     choice labels and scene titles (titles surface in resume labels / art alt).
 *     Tiered: strong (almost always a leak) vs weak (needs hand review).
 *  3. Real-prose length — words after removing repeats; flag < MIN_REAL (250).
 *  4. Structure — broken choice targets, unreachable scenes, dead ends before
 *     L10, L10 with choices, empty text/textHot, missing choice textHot,
 *     id/filename/layer mismatches, stub markers.
 *  5. Names — old LI names, stray "Jake", and cross-story character leaks.
 *
 * Never writes to story files. Only writes the optional --json / --md outputs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { META_TERMS, OLD_NAMES as LIB_OLD_NAMES } from './lib/story-quality.mjs';

const args = process.argv.slice(2);
function opt(name, def) {
  const i = args.indexOf(name);
  if (i === -1) return def;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
}
const ROOT = path.resolve(opt('--root', path.resolve(import.meta.dirname, '..')));
const JSON_OUT = opt('--json', null);
const MD_OUT = opt('--md', null);
const MIN_REAL = Number(opt('--min-real', 250));
const MIN_SCENES = Number(opt('--min-scenes', 3));
const PARA_MIN_WORDS = 12;
const SENT_MIN_WORDS = 20;
const PARA_SIM = 0.75;
const NGRAM = 10;
const STORIES_DIR = path.join(ROOT, 'artifacts/stories');

// ---------- per-story name config ----------
const NAMES = {
  'until-the-quiet-breaks': { li: ['John Shaw', 'John'], own: ['John Shaw', 'Henry Shaw', 'Clara Shaw', 'Somerton', 'Willow Lane', 'Market Street'] },
  'what-the-sister-kept': { li: ['William Akers', 'Will', 'William'], own: ['Akers', 'Renny', 'Mara Ellison', 'Owen Vale', 'Lila Cho', 'Harborwick'] },
  'the-living-key': { li: ['Cassian Rook', 'Cassian'], own: ['Cassian', 'Rook', 'Vesper', 'Thorne', 'Isolde Vane', 'Maris Quill', 'Bram Kestrel', 'Ashmere', 'Calderyn', 'Unmade'] },
  'the-soft-alibi': { li: ['Nolan Greer', 'Nolan'], own: ['Nolan', 'Greer', 'Vivienne', 'Imani Brooks', 'Crownspire'] },
};
// distinctive tokens that must not appear outside their own story
const CROSS = {
  'until-the-quiet-breaks': [/\bShaw\b/, /\bClara\b/, /\bSomerton\b/, /\bWillow Lane\b/],
  'what-the-sister-kept': [/\bAkers\b/, /\bRenny\b/, /\bEllison\b/, /\bOwen Vale\b/, /\bLila Cho\b/, /\bHarborwick\b/],
  'the-living-key': [/\bCassian\b/, /\bRook\b/, /\bVesper\b/, /\bThorne\b/, /\bIsolde\b/, /\bMaris\b/, /\bKestrel\b/, /\bAshmere\b/, /\bCalderyn\b/, /\bUnmade\b/],
  'the-soft-alibi': [/\bNolan\b/, /\bGreer\b/, /\bVivienne\b/, /\bImani\b/, /\bCrownspire\b/],
};
const OLD_NAMES = LIB_OLD_NAMES;

// ---------- meta-leak patterns ----------
// LEAK: hand-reviewed on 2026-09-24 across Quiet Breaks / Sister Kept / Living Key / Soft Alibi —
// these are planning/craft jargon that has no business in reader-facing prose (precision ~95%+).
// REVIEW: words with legitimate in-world uses ("her father's ending", "crime scene", "a branch
// dripped") — listed for a human pass, not counted as leaks.
// The hard-leak list the CI guardrail enforces lives in scripts/lib/story-quality.mjs
// (META_TERMS). The audit adds a few broader report-only terms on top.
const AUDIT_ONLY = [
  /\bverbs?\b/i,                                   // "waiting on your verb" tic (the test only flags it in narration)
  /\bintimacy[- ]forward\b/i, /\blove interest\b/i, /\bprotagonist\b/i,
  /\bsmut\b/i, /\bBookTok\b/i, /\bspice (?:level|tier)\b/i, /\bspicy\b/i, /\breaders?\b/i, /\bplayers?\b(?!_name)/i,
  /\bprompts?\b/i, /\bpremise\b/i, /\bspec\b/i, /\btextHot\b/, /\bunderplot\b/i, /\bscene's weather\b/i,
  /\bfilthy craft\b/i, /\bplot's engine\b/i, /\badvanced the plot\b/i, /\bthe plot (?:gets|paid)\b/i, /\bchapter where\b/i,
  /\bslow[- ]burn\b/i, /\btropes?\b/i, /\bfade[- ]to[- ]black\b/i, /\bon[- ]page\b/i, /\bword (?:count|minimum)s?\b/i,
  /\bconsequence verbs?\b/i, /\bIP[- ]lock\b/i, /\bcanon\b/i, /\b(?:four|all) fates\b/i,
];
const LEAK = [...META_TERMS, ...AUDIT_ONLY.filter((r) => !META_TERMS.some((m) => m.source === r.source))];
const REVIEW = [
  /\bendings?\b/i, /\bscenes?\b/i, /\bnarrative\b/i, /\bbranch(?:es|ing)?\b/i, /\bplot\b/i, /\bcraft\b/i, /\bhook\b/i,
  /\bsoft[- ]?(?:landing|landed|land|arrival)s?\b/i, /\bchoices?\b/i, /\btree\b/i, /\bbeats?\b/i, /\barc\b/i, /\bhinge\b/i,
  /\bspice\b/i, /\bchapter\b/i, /\bfork\b/i,
];

// 'stub' alone is excluded: "ticket stub" is real prose in these books.
const STUBS = /\b(?:TODO|TBD|FIXME|XXX|STUB)\b|lorem ipsum|\blorem\b|\bplaceholder\b|\[stub\]|\[(?:insert|tk)[^\]]*\]/;

// ---------- text helpers ----------
const WORD_RE = /[A-Za-z0-9\[\]_’'-]+/g;
function words(s) { return (s.match(WORD_RE) || []); }
function normWords(s) {
  return words(
    s.toLowerCase()
      .replace(/\[player_name\]/g, ' pn ')
      .replace(/[’‘]/g, "'")
      .replace(/\d+/g, '#')
  ).map((w) => w.replace(/^['-]+|['-]+$/g, '')).filter(Boolean);
}
function paragraphs(text) { return String(text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean); }
function sentences(par) {
  // split on . ! ? … followed by space/quote + capital-ish; keep it simple
  return par.replace(/\s+/g, ' ').replace(/\b(Mr|Mrs|Ms|Dr|St|Capt|Det|Sgt)\. /g, '$1\u00a7 ')
    .split(/(?<=[.!?…]["”’)*]?)\s+(?=["“‘(*]?[A-Z\[])/).map((s) => s.replace(/\u00a7/g, '.').trim()).filter(Boolean);
}
function shingles(ws, k = 3) {
  const out = new Set();
  if (ws.length < k) { out.add(ws.join(' ')); return out; }
  for (let i = 0; i + k <= ws.length; i++) out.add(ws.slice(i, i + k).join(' '));
  return out;
}
function jaccard(a, b) {
  let inter = 0;
  const [s, l] = a.size < b.size ? [a, b] : [b, a];
  for (const x of s) if (l.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// ---------- loading ----------
async function loadStory(id) {
  const dir = path.join(STORIES_DIR, id, 'scenes');
  const files = fs.readdirSync(dir).filter((f) => /^scene.*\.js$/.test(f)).sort();
  const scenes = [];
  for (const f of files) {
    const mod = await import(pathToFileURL(path.join(dir, f)).href + `?t=${Date.now()}`);
    scenes.push({ file: f, ...mod.default });
  }
  scenes.sort((a, b) => (a.layer - b.layer) || String(a.id).localeCompare(String(b.id)));
  return scenes;
}

// ---------- 1. repeats ----------
function analyzeRepeats(scenes, field) {
  // Paragraph units
  const paras = []; // {sid, idx, raw, nw, sh, key}
  const sents = [];
  for (const sc of scenes) {
    paragraphs(sc[field]).forEach((p, idx) => {
      const nw = normWords(p);
      const u = { sid: sc.id, idx, raw: p, nw, key: nw.join(' ') };
      if (nw.length >= PARA_MIN_WORDS) { u.sh = shingles(nw); paras.push(u); }
      sentences(p).forEach((s, si) => {
        const snw = normWords(s);
        if (snw.length >= SENT_MIN_WORDS) sents.push({ sid: sc.id, pidx: idx, si, raw: s, nw: snw, key: snw.join(' ') });
      });
    });
  }
  // Union-find cluster paragraphs by exact key then Jaccard via inverted index
  const parent = paras.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
  const byKey = new Map();
  paras.forEach((p, i) => { if (byKey.has(p.key)) union(byKey.get(p.key), i); else byKey.set(p.key, i); });
  const inv = new Map();
  paras.forEach((p, i) => { for (const s of p.sh) { if (!inv.has(s)) inv.set(s, []); inv.get(s).push(i); } });
  paras.forEach((p, i) => {
    const cnt = new Map();
    for (const s of p.sh) for (const j of inv.get(s)) if (j > i) cnt.set(j, (cnt.get(j) || 0) + 1);
    for (const [j, c] of cnt) {
      const q = paras[j];
      const approx = c / (p.sh.size + q.sh.size - c);
      if (approx >= PARA_SIM) union(i, j);
    }
  });
  const clusters = new Map();
  paras.forEach((p, i) => { const r = find(i); if (!clusters.has(r)) clusters.set(r, []); clusters.get(r).push(p); });
  const repParaSet = new Set(); // `${sid}#${idx}`
  const paraClusters = [];
  for (const members of clusters.values()) {
    const sids = new Set(members.map((m) => m.sid));
    if (sids.size >= MIN_SCENES) {
      members.forEach((m) => repParaSet.add(`${m.sid}#${m.idx}`));
      paraClusters.push({ scenes: [...sids], occurrences: members.length, words: members[0].nw.length, sample: members[0].raw });
    }
  }
  paraClusters.sort((a, b) => b.scenes.length * b.words - a.scenes.length * a.words);

  // Sentences: exact normalized key, plus near-dup via 3-gram jaccard >=0.8 (inverted index)
  const sParent = sents.map((_, i) => i);
  const sFind = (i) => (sParent[i] === i ? i : (sParent[i] = sFind(sParent[i])));
  const sUnion = (a, b) => { a = sFind(a); b = sFind(b); if (a !== b) sParent[b] = a; };
  const sByKey = new Map();
  sents.forEach((s, i) => { s.sh = shingles(s.nw); if (sByKey.has(s.key)) sUnion(sByKey.get(s.key), i); else sByKey.set(s.key, i); });
  const sInv = new Map();
  sents.forEach((s, i) => { for (const x of s.sh) { if (!sInv.has(x)) sInv.set(x, []); sInv.get(x).push(i); } });
  sents.forEach((s, i) => {
    const cnt = new Map();
    for (const x of s.sh) for (const j of sInv.get(x)) if (j > i) cnt.set(j, (cnt.get(j) || 0) + 1);
    for (const [j, c] of cnt) if (c / (s.sh.size + sents[j].sh.size - c) >= 0.8) sUnion(i, j);
  });
  const sClusters = new Map();
  sents.forEach((s, i) => { const r = sFind(i); if (!sClusters.has(r)) sClusters.set(r, []); sClusters.get(r).push(s); });
  const repSentSet = new Set(); // `${sid}#${pidx}#${si}`
  const sentClusters = [];
  for (const members of sClusters.values()) {
    const sids = new Set(members.map((m) => m.sid));
    if (sids.size >= MIN_SCENES) {
      members.forEach((m) => repSentSet.add(`${m.sid}#${m.pidx}#${m.si}`));
      sentClusters.push({ scenes: [...sids], occurrences: members.length, words: members[0].nw.length, sample: members[0].raw });
    }
  }
  sentClusters.sort((a, b) => b.scenes.length * b.words - a.scenes.length * a.words);

  // n-gram coverage
  const gramScenes = new Map();
  const sceneNw = new Map();
  for (const sc of scenes) {
    const nw = normWords(sc[field] || '');
    sceneNw.set(sc.id, nw);
    const seen = new Set();
    for (let i = 0; i + NGRAM <= nw.length; i++) {
      const g = nw.slice(i, i + NGRAM).join(' ');
      if (seen.has(g)) continue; seen.add(g);
      gramScenes.set(g, (gramScenes.get(g) || 0) + 1);
    }
  }

  // per scene stats
  const perScene = {};
  const intraClusters = [];
  for (const sc of scenes) {
    let total = 0, rep = 0, intra = 0;
    const realParts = [];
    // intra-scene duplicates: 2nd+ copy of a paragraph (>=8 words, near-dup) or sentence (>=10 words)
    const seenParas = []; const seenSents = new Map();
    paragraphs(sc[field]).forEach((p, idx) => {
      const pw = words(p).length;
      total += pw;
      const pnw = normWords(p);
      if (repParaSet.has(`${sc.id}#${idx}`)) { rep += pw; return; }
      if (pnw.length >= 8) {
        const sh = shingles(pnw);
        const dup = seenParas.find((q) => jaccard(q.sh, sh) >= PARA_SIM);
        if (dup) { rep += pw; intra += pw; dup.n++; return; }
        seenParas.push({ sh, n: 1, raw: p });
      }
      const keep = [];
      sentences(p).forEach((s, si) => {
        const snw = normWords(s); const key = snw.join(' ');
        if (repSentSet.has(`${sc.id}#${idx}#${si}`)) { rep += words(s).length; return; }
        if (snw.length >= 10 && seenSents.has(key)) { rep += words(s).length; intra += words(s).length; seenSents.get(key).n++; return; }
        if (snw.length >= 10) seenSents.set(key, { n: 1, raw: s });
        keep.push(s);
      });
      realParts.push(keep.join(' '));
    });
    for (const q of seenParas) if (q.n > 1) intraClusters.push({ scene: sc.id, kind: 'paragraph', copies: q.n, sample: q.raw });
    for (const q of seenSents.values()) if (q.n > 1) intraClusters.push({ scene: sc.id, kind: 'sentence', copies: q.n, sample: q.raw });
    const nw = sceneNw.get(sc.id);
    const cov = new Uint8Array(nw.length);
    for (let i = 0; i + NGRAM <= nw.length; i++) {
      if ((gramScenes.get(nw.slice(i, i + NGRAM).join(' ')) || 0) >= MIN_SCENES) cov.fill(1, i, i + NGRAM);
    }
    const covered = cov.reduce((a, b) => a + b, 0);
    perScene[sc.id] = {
      total, repeated: rep, intraRepeated: intra, real: total - rep, realText: realParts.join('\n\n'),
      pct: total ? +(100 * rep / total).toFixed(1) : 0,
      ngramPct: nw.length ? +(100 * covered / nw.length).toFixed(1) : 0,
    };
  }
  return { perScene, paraClusters, sentClusters, intraClusters };
}

// ---------- 2. meta leaks ----------
function scanMeta(scenes) {
  const hits = [];
  for (const sc of scenes) {
    const surfaces = [
      ['text', sc.text], ['textHot', sc.textHot], ['title', sc.title],
      ...(sc.choices || []).flatMap((c, i) => [[`choice${i}.text`, c.text], [`choice${i}.textHot`, c.textHot]]),
    ];
    for (const [surface, val] of surfaces) {
      if (!val) continue;
      for (const p of paragraphs(val)) for (const s of sentences(p)) {
        const s2 = s.replace(/\[player_name\]/g, '');
        const leak = LEAK.filter((r) => r.test(s2)).map((r) => (s2.match(r) || [''])[0]);
        const review = leak.length ? [] : REVIEW.filter((r) => r.test(s2)).map((r) => (s2.match(r) || [''])[0]);
        // "verb" alone = the choice-as-verb tic ("Pick the verb") — reported separately from hard leaks
        const tier = leak.length ? (leak.every((t) => /^verbs?$/i.test(t)) ? 'tic' : 'leak') : 'review';
        if (leak.length || review.length) hits.push({ sid: sc.id, layer: sc.layer, surface, prose: surface === 'text' || surface === 'textHot', tier, terms: [...new Set([...leak, ...review])], sentence: s });
      }
    }
  }
  return hits;
}

// ---------- 2b. spec echo: 5+-word runs lifted from PREMISE.md / TREE.md into prose ----------
const ECHO_N = 5;
const ECHO_STOP = new Set(['the', 'a', 'an', 'and', 'of', 'to', 'in', 'on', 'her', 'his', 'she', 'he', 'it', 'is', 'was', 'with', 'for', 'at', 'that', 'pn', 'as', 'by', 'or', 'but', 'not', 'be', 'from', 'into', 'you', 'i']);
function scanSpecEcho(storyId, scenes) {
  const docs = ['PREMISE.md', 'TREE.md'].map((f) => path.join(STORIES_DIR, storyId, f)).filter(fs.existsSync).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const dw = normWords(docs);
  const grams = new Set();
  for (let i = 0; i + ECHO_N <= dw.length; i++) {
    const g = dw.slice(i, i + ECHO_N);
    if (g.filter((w) => !ECHO_STOP.has(w)).length >= 3) grams.add(g.join(' '));
  }
  const hits = [];
  for (const sc of scenes) for (const [surface, val] of [['text', sc.text], ['textHot', sc.textHot]]) {
    if (!val) continue;
    for (const p of paragraphs(val)) for (const s of sentences(p)) {
      const nw = normWords(s);
      const found = [];
      for (let i = 0; i + ECHO_N <= nw.length; i++) { const g = nw.slice(i, i + ECHO_N).join(' '); if (grams.has(g)) found.push(g); }
      if (found.length) hits.push({ sid: sc.id, surface, grams: [...new Set(found)], sentence: s });
    }
  }
  return hits;
}

// ---------- 4. structure ----------
function checkStructure(storyId, scenes, startId = 'scene1') {
  const ids = new Set(scenes.map((s) => s.id));
  const incoming = new Map([...ids].map((i) => [i, 0]));
  const issues = [];
  const maxLayer = Math.max(...scenes.map((s) => s.layer));
  for (const sc of scenes) {
    const fileId = sc.file.replace(/\.js$/, '');
    if (sc.id !== fileId) issues.push({ sid: sc.id, kind: 'id-filename-mismatch', detail: `${sc.file} exports id ${sc.id}` });
    const m = /^scene(\d+)/.exec(sc.id);
    if (m && Number(m[1]) !== sc.layer) issues.push({ sid: sc.id, kind: 'layer-mismatch', detail: `layer=${sc.layer}` });
    if (!String(sc.text || '').trim()) issues.push({ sid: sc.id, kind: 'empty-text' });
    if (!String(sc.textHot || '').trim()) issues.push({ sid: sc.id, kind: 'empty-textHot' });
    for (const f of ['text', 'textHot', 'title']) {
      const mm = STUBS.exec(String(sc[f] || ''));
      if (mm) issues.push({ sid: sc.id, kind: 'stub-marker', detail: `${f}: "${mm[0]}"` });
    }
    const ch = Array.isArray(sc.choices) ? sc.choices : [];
    ch.forEach((c, i) => {
      if (!c || !c.id) { issues.push({ sid: sc.id, kind: 'choice-missing-id', detail: `#${i}` }); return; }
      if (!ids.has(c.id)) issues.push({ sid: sc.id, kind: 'broken-target', detail: c.id });
      else {
        incoming.set(c.id, incoming.get(c.id) + 1);
        const tl = scenes.find((s) => s.id === c.id).layer;
        if (tl !== sc.layer + 1) issues.push({ sid: sc.id, kind: 'non-adjacent-target', detail: `${c.id} (L${tl})` });
      }
      if (!String(c.text || '').trim()) issues.push({ sid: sc.id, kind: 'choice-empty-text', detail: c.id });
      if (!String(c.textHot || '').trim()) issues.push({ sid: sc.id, kind: 'choice-missing-textHot', detail: c.id });
      if (STUBS.test(`${c.text} ${c.textHot}`)) issues.push({ sid: sc.id, kind: 'stub-marker', detail: `choice ${c.id}` });
    });
    const engineEnding = ch.length === 0 || !ch.every((c) => c && ids.has(c.id));
    if (sc.layer < maxLayer && engineEnding) issues.push({ sid: sc.id, kind: 'dead-end-before-final-layer', detail: ch.length ? 'has broken target(s): engine hides all choices' : 'no choices' });
    if (sc.layer === maxLayer && ch.length) issues.push({ sid: sc.id, kind: 'final-layer-has-choices', detail: ch.map((c) => c.id).join(',') });
  }
  for (const [id, n] of incoming) if (n === 0 && id !== startId) issues.push({ sid: id, kind: 'unreachable', detail: 'no incoming choice' });
  const reach = new Set([startId]); const q = [startId];
  while (q.length) { const curId = q.shift(); const cur = scenes.find((s) => s.id === curId); for (const c of (cur?.choices || [])) if (c && ids.has(c.id) && !reach.has(c.id)) { reach.add(c.id); q.push(c.id); } }
  for (const id of ids) if (!reach.has(id) && incoming.get(id) > 0) issues.push({ sid: id, kind: 'unreachable', detail: 'only reachable from unreachable scenes' });
  if (!ids.has(startId)) issues.push({ sid: startId, kind: 'missing-start-scene' });
  return issues;
}

// ---------- 5. names ----------
function checkNames(storyId, scenes) {
  const issues = [];
  for (const sc of scenes) {
    const surfaces = [['text', sc.text], ['textHot', sc.textHot], ['title', sc.title], ...(sc.choices || []).flatMap((c, i) => [[`choice${i}.text`, c.text], [`choice${i}.textHot`, c.textHot]])];
    for (const [surface, val] of surfaces) {
      if (!val) continue;
      for (const s of sentences(String(val).replace(/\n/g, ' '))) {
        for (const r of OLD_NAMES) if (r.test(s)) { issues.push({ sid: sc.id, surface, kind: 'old-name', term: s.match(r)[0], sentence: s }); break; }
        for (const [other, regs] of Object.entries(CROSS)) {
          if (other === storyId) continue;
          for (const r of regs) if (r.test(s)) issues.push({ sid: sc.id, surface, kind: 'cross-story', term: `${s.match(r)[0]} (${other})`, sentence: s });
        }
      }
    }
  }
  // LI presence summary
  const cfg = NAMES[storyId];
  const liCount = cfg ? scenes.filter((sc) => new RegExp(`\\b${cfg.li[cfg.li.length > 1 ? 1 : 0]}\\b`).test(`${sc.text} ${sc.textHot}`)).length : null;
  return { issues, liScenes: liCount };
}

// ---------- 6. readability (on real prose, padding removed) ----------
const FILLER = {
  commaChain3: /(?:[^,]*,){3,}/,                                  // 3+ commas in one sentence
  dashStack: /(?:—[^—]*){2,}/,                                     // 2+ em-dash asides
  theWay: /\bthe way (?:that )?\b/i,
  asIf: /\bas (?:if|though)\b/i,
  somethingLike: /\bsomething (?:like|close to|almost)\b/i,
  likeSimile: /\blike (?:a|an|the|someone|something)\b/i,
  andChain: /\band\b.*\band\b.*\band\b/i,                           // 3+ "and" in one sentence
  adjPile: /\b\w+(?:ed|y|ful|ous|ive|less|ish|al|ent|ant|ic|-\w+),\s+\w+(?:ed|y|ful|ous|ive|less|ish|al|ent|ant|ic|-\w+),\s+(?:and\s+)?\w+(?:ed|y|ful|ous|ive|less|ish|al|ent|ant|ic|-\w+)\b/i, // X, Y, Z modifier piles
  notNot: /\bnot (?:\w+ ){0,3}\w+\. Not\b/,                        // "Not pretty. Not polite." cadence (checked on paragraph)
};
function readability(text) {
  const sents = [];
  for (const p of paragraphs(text)) for (const s of sentences(p)) { const n = words(s).length; if (n) sents.push({ s, n }); }
  const n = sents.length || 1;
  const wc = sents.reduce((a, x) => a + x.n, 0);
  const patterns = Object.fromEntries(Object.keys(FILLER).map((k) => [k, 0]));
  for (const x of sents) for (const [k, r] of Object.entries(FILLER)) if (k !== 'notNot' && r.test(x.s)) patterns[k]++;
  for (const p of paragraphs(text)) patterns.notNot += (p.match(/\bNot \w+(?: \w+){0,3}\. Not\b/g) || []).length;
  return {
    sentences: sents.length, words: wc, avg: +(wc / n).toFixed(1),
    over30: sents.filter((x) => x.n > 30).length, over40: sents.filter((x) => x.n > 40).length,
    under6: sents.filter((x) => x.n < 6).length, lens: sents.map((x) => x.n),
    longest: [...sents].sort((a, b) => b.n - a.n).slice(0, 5), patterns,
  };
}
const MAX_AVG = Number(opt('--max-avg-sentence', 22));
const MAX_PCT30 = Number(opt('--max-pct-over30', 10)); // secondary flag: long-sentence tail
const pctile = (arr, q) => { if (!arr.length) return 0; const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * a.length))]; };

// ---------- main ----------
const targets = (args.length ? args : fs.readdirSync(STORIES_DIR).filter((d) => fs.existsSync(path.join(STORIES_DIR, d, 'scenes'))))
  .map((t) => { const [id, layers] = t.split(':'); return { id, layers: layers ? new Set(layers.split(',').map(Number)) : null }; });

const report = {};
for (const { id, layers } of targets) {
  const scenes = await loadStory(id);
  const inScope = (sid) => !layers || layers.has(scenes.find((s) => s.id === sid)?.layer);
  const warm = analyzeRepeats(scenes, 'text');
  const hot = analyzeRepeats(scenes, 'textHot');
  const scoped = scenes.filter((s) => inScope(s.id));
  const perScene = scoped.map((s) => ({ id: s.id, layer: s.layer, warm: warm.perScene[s.id], hot: hot.perScene[s.id] }));
  const filterClusters = (cl) => cl.filter((c) => c.scenes.some(inScope)).map((c) => ({ ...c, scopedScenes: c.scenes.filter(inScope) }));
  const meta = scanMeta(scoped);
  const specEcho = scanSpecEcho(id, scoped);
  const readab = { warm: { scenes: {} }, hot: { scenes: {} } };
  for (const [mode, res] of [['warm', warm], ['hot', hot]]) {
    const agg = { sentences: 0, words: 0, over30: 0, over40: 0, under6: 0, lens: [], longest: [], patterns: Object.fromEntries(Object.keys(FILLER).map((k) => [k, 0])) };
    for (const sc of scoped) {
      const rd = readability(res.perScene[sc.id].realText);
      readab[mode].scenes[sc.id] = { avg: rd.avg, sentences: rd.sentences, over30: rd.over30, over40: rd.over40, pctOver30: +(100 * rd.over30 / Math.max(1, rd.sentences)).toFixed(1), patterns: rd.patterns };
      agg.sentences += rd.sentences; agg.words += rd.words; agg.over30 += rd.over30; agg.over40 += rd.over40; agg.under6 += rd.under6; agg.lens.push(...rd.lens);
      agg.longest.push(...rd.longest.map((x) => ({ sid: sc.id, n: x.n, s: x.s })));
      for (const k of Object.keys(agg.patterns)) agg.patterns[k] += rd.patterns[k];
    }
    agg.longest = agg.longest.sort((a, b) => b.n - a.n).slice(0, 5);
    readab[mode].summary = {
      avg: +(agg.words / Math.max(1, agg.sentences)).toFixed(1), sentences: agg.sentences,
      pctOver30: +(100 * agg.over30 / Math.max(1, agg.sentences)).toFixed(1), pctOver40: +(100 * agg.over40 / Math.max(1, agg.sentences)).toFixed(1),
      median: pctile(agg.lens, 0.5), p90: pctile(agg.lens, 0.9), pctUnder6: +(100 * agg.under6 / Math.max(1, agg.sentences)).toFixed(1),
      longest: agg.longest,
      patternsPer1k: Object.fromEntries(Object.entries(agg.patterns).map(([k, v]) => [k, +(1000 * v / Math.max(1, agg.words)).toFixed(2)])),
      patternCounts: agg.patterns,
      scenesOverAvg: Object.entries(readab[mode].scenes).filter(([, v]) => v.avg > MAX_AVG).map(([k]) => k),
      scenesLongTail: Object.entries(readab[mode].scenes).filter(([, v]) => v.pctOver30 > MAX_PCT30).map(([k]) => k),
    };
  }
  for (const mode of ['warm', 'hot']) for (const sc of scoped) delete (mode === 'warm' ? warm : hot).perScene[sc.id].realText;
  const structure = checkStructure(id, scenes).filter((i) => inScope(i.sid));
  const names = checkNames(id, scoped);
  const sum = (k, f) => perScene.reduce((a, s) => a + s[k][f], 0);
  report[id] = {
    scope: layers ? [...layers].map((l) => `L${l}`).join(',') : 'all',
    scenes: scenes.length, scopedScenes: scoped.length,
    summary: {
      warmPadded20: perScene.filter((s) => s.warm.pct > 20).length,
      hotPadded20: perScene.filter((s) => s.hot.pct > 20).length,
      anyPadded20: perScene.filter((s) => s.warm.pct > 20 || s.hot.pct > 20).length,
      warmIntraWords: sum('warm', 'intraRepeated'), hotIntraWords: sum('hot', 'intraRepeated'),
      warmWords: sum('warm', 'total'), hotWords: sum('hot', 'total'),
      warmPaddedWords: sum('warm', 'repeated'), hotPaddedWords: sum('hot', 'repeated'),
      warmUnderMin: perScene.filter((s) => s.warm.real < MIN_REAL).map((s) => s.id),
      hotUnderMin: perScene.filter((s) => s.hot.real < MIN_REAL).map((s) => s.id),
      metaLeakProse: meta.filter((h) => h.tier === 'leak' && h.prose).length,
      metaLeakProseUnique: new Set(meta.filter((h) => h.tier === 'leak' && h.prose).map((h) => normWords(h.sentence).join(' '))).size,
      metaLeakScenes: new Set(meta.filter((h) => h.tier === 'leak' && h.prose).map((h) => h.sid)).size,
      metaLeakLabels: meta.filter((h) => h.tier === 'leak' && !h.prose).length,
      metaVerbTic: meta.filter((h) => h.tier === 'tic' && h.prose).length,
      metaReview: meta.filter((h) => h.tier === 'review').length,
      specEchoSentences: specEcho.length,
      structureIssues: structure.length,
      nameIssues: names.issues.length,
    },
    perScene,
    repeats: { warmIntra: warm.intraClusters.filter((c) => inScope(c.scene)), hotIntra: hot.intraClusters.filter((c) => inScope(c.scene)), warmParagraphs: filterClusters(warm.paraClusters), hotParagraphs: filterClusters(hot.paraClusters), warmSentences: filterClusters(warm.sentClusters), hotSentences: filterClusters(hot.sentClusters) },
    readability: readab, meta, specEcho, structure, names,
  };
}

if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));

// console / md summary
const lines = [];
const trunc = (s, n = 220) => (s.length > n ? s.slice(0, n) + '…' : s);
for (const [id, r] of Object.entries(report)) {
  const s = r.summary;
  lines.push(`## ${id} (scope: ${r.scope}; ${r.scopedScenes}/${r.scenes} scenes)`, '');
  lines.push(`- Scenes >20% padding: Warm ${s.warmPadded20}, Hot ${s.hotPadded20} (either: ${s.anyPadded20})`);
  lines.push(`- Padded words: Warm ${s.warmPaddedWords}/${s.warmWords} (${(100 * s.warmPaddedWords / Math.max(1, s.warmWords)).toFixed(1)}%), Hot ${s.hotPaddedWords}/${s.hotWords} (${(100 * s.hotPaddedWords / Math.max(1, s.hotWords)).toFixed(1)}%)`);
  lines.push(`  (of which intra-scene duplicate copies: Warm ${s.warmIntraWords}, Hot ${s.hotIntraWords})`);
  lines.push(`- Under ${MIN_REAL} real words: Warm ${s.warmUnderMin.length}, Hot ${s.hotUnderMin.length}`);
  lines.push(`- Meta leaks in prose: ${s.metaLeakProse} sentences (${s.metaLeakProseUnique} unique) in ${s.metaLeakScenes} scenes; in titles/choice labels: ${s.metaLeakLabels}; choice-as-verb tic sentences (\"pick the verb\"): ${s.metaVerbTic}; ambiguous words for human review: ${s.metaReview}`);
  lines.push(`- Structure issues: ${s.structureIssues}; name issues: ${s.nameIssues}`, '');
  lines.push('| scene | L | Warm words | Warm pad% | Warm real | Warm 10g% | Warm avg sent | Hot words | Hot pad% | Hot real | Hot 10g% | Hot avg sent |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const p of r.perScene) { const wa = r.readability.warm.scenes[p.id].avg, ha = r.readability.hot.scenes[p.id].avg; lines.push(`| ${p.id} | ${p.layer} | ${p.warm.total} | ${p.warm.pct} | ${p.warm.real}${p.warm.real < MIN_REAL ? ' ⚠' : ''} | ${p.warm.ngramPct} | ${wa}${wa > MAX_AVG ? ' ⚠' : ''} | ${p.hot.total} | ${p.hot.pct} | ${p.hot.real}${p.hot.real < MIN_REAL ? ' ⚠' : ''} | ${p.hot.ngramPct} | ${ha}${ha > MAX_AVG ? ' ⚠' : ''} |`); }
  lines.push('');
  for (const [k, label] of [['warmParagraphs', 'Warm repeated paragraphs'], ['hotParagraphs', 'Hot repeated paragraphs'], ['warmSentences', 'Warm repeated long sentences'], ['hotSentences', 'Hot repeated long sentences']]) {
    const cl = r.repeats[k];
    lines.push(`### ${label} (${cl.length} clusters)`, '');
    for (const c of cl.slice(0, 25)) lines.push(`- **${c.scenes.length} scenes / ${c.occurrences}×, ${c.words}w** — “${trunc(c.sample)}” — ${c.scenes.slice(0, 12).join(', ')}${c.scenes.length > 12 ? ', …' : ''}`);
    if (cl.length > 25) lines.push(`- … ${cl.length - 25} more`);
    lines.push('');
  }
  for (const [k, label] of [['warmIntra', 'Warm intra-scene duplicates'], ['hotIntra', 'Hot intra-scene duplicates']]) {
    const cl = r.repeats[k];
    lines.push(`### ${label} (${cl.length})`, '');
    for (const c of cl) lines.push(`- ${c.scene} ${c.kind} ×${c.copies} — “${trunc(c.sample, 160)}”`);
    lines.push('');
  }
  lines.push(`### Readability (real prose, padding removed; flag avg > ${MAX_AVG} words/sentence)`, '');
  for (const mode of ['warm', 'hot']) {
    const rs = r.readability[mode].summary;
    lines.push(`**${mode === 'warm' ? 'Warm' : 'Hot'}** — avg ${rs.avg} w/sentence over ${rs.sentences} sentences; >30w: ${rs.pctOver30}%; >40w: ${rs.pctOver40}%; median ${rs.median}, p90 ${rs.p90}, <6w fragments ${rs.pctUnder6}%; scenes avg>${MAX_AVG}: ${rs.scenesOverAvg.length} (${rs.scenesOverAvg.join(', ') || 'none'}); scenes with >${MAX_PCT30}% sentences over 30w: ${rs.scenesLongTail.length} (${rs.scenesLongTail.join(', ') || 'none'})`, '');
    lines.push(`Filler/stacking per 1k words: ${Object.entries(rs.patternsPer1k).map(([k, v]) => `${k} ${v} (${rs.patternCounts[k]})`).join('; ')}`, '');
    lines.push('Longest sentences:');
    for (const x of rs.longest) lines.push(`- ${x.sid} (${x.n}w): “${trunc(x.s, 600)}”`);
    lines.push('');
  }
  lines.push(`### Meta/planning hits (leak tier first; review tier = ambiguous words, mostly legit)`, '');
  const grouped = new Map();
  for (const h of [...r.meta].sort((a, b) => (({ leak: 0, tic: 1, review: 2 })[a.tier] - ({ leak: 0, tic: 1, review: 2 })[b.tier]))) {
    const key = `${h.tier}|${normWords(h.sentence).join(' ')}`;
    if (!grouped.has(key)) grouped.set(key, { ...h, where: [] });
    grouped.get(key).where.push(`${h.sid}:${h.surface}`);
  }
  for (const g of grouped.values()) lines.push(`- [${g.tier}] (${g.terms.join(', ')}) ×${g.where.length} ${g.where.slice(0, 6).join(' ')}${g.where.length > 6 ? ' …' : ''} — “${trunc(g.sentence, 300)}”`);
  lines.push('', `### Spec echo (5-word runs copied from PREMISE.md/TREE.md into prose): ${r.specEcho.length} sentences`, '');
  const eg = new Map();
  for (const h of r.specEcho) for (const g of h.grams) { if (!eg.has(g)) eg.set(g, { n: 0, ex: h }); eg.get(g).n++; }
  for (const [g, v] of [...eg].sort((a, b) => b[1].n - a[1].n).slice(0, 40)) lines.push(`- “${g}” ×${v.n} — e.g. ${v.ex.sid}:${v.ex.surface} “${trunc(v.ex.sentence, 200)}”`);
  lines.push('', '### Structure', '');
  if (!r.structure.length) lines.push('- none');
  for (const i of r.structure) lines.push(`- ${i.kind}: ${i.sid}${i.detail ? ` — ${i.detail}` : ''}`);
  lines.push('', '### Names', '');
  if (!r.names.issues.length) lines.push('- none');
  for (const i of r.names.issues) lines.push(`- ${i.kind} ${i.term}: ${i.sid}:${i.surface} — “${trunc(i.sentence)}”`);
  lines.push('');
}
const md = lines.join('\n');
if (MD_OUT) fs.writeFileSync(MD_OUT, md);
else console.log(md);
