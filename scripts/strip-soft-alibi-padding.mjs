#!/usr/bin/env node
/**
 * Strip repeated padding and planning/meta language from The Soft Alibi,
 * layers 2–9 (scene2a … scene9h — whatever IDs exist).
 *
 * Removes from both `text` and `textHot`:
 *   (a) the stock padding paragraphs, plus any paragraph that appears
 *       verbatim in 3+ scenes;
 *   (b) sentences of planning/meta language (layers, choices/labels/verbs,
 *       tree/spec, romance-lock, heat-level / POV rules, …) — see
 *       scripts/lib/soft-alibi-clean.mjs;
 *   (c) the spec pronoun tag "she/her" inside descriptive phrases.
 * Never adds prose. IDs, titles, layers, and choices are untouched (the script
 * edits only the two template literals in each file and verifies the rest).
 *
 * Idempotent: a second run changes nothing.
 * Usage: node scripts/strip-soft-alibi-padding.mjs [--check]   (--check = no writes)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import {
  wc, splitParagraphs, splitSentences, stripMeta, sharedParagraphs, isStockPad, findMeta, trimClauses,
} from "./lib/soft-alibi-clean.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, "../artifacts/stories/the-soft-alibi/scenes");
const CHECK = process.argv.includes("--check");
const MIN_WARN = 80;

const files = fs.readdirSync(DIR).filter((f) => /^scene[2-9][a-z]\.js$/.test(f))
  .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

async function load(f) {
  const url = pathToFileURL(path.join(DIR, f)).href + `?t=${Date.now()}${Math.random()}`;
  return (await import(url)).default;
}

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

/** Replace the body of `  <key>: \`...\`` in module source. */
function replaceLiteral(src, key, value) {
  const marker = `\n  ${key}: \``;
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`no ${key} literal`);
  const bodyStart = start + marker.length;
  let i = bodyStart;
  while (i < src.length) {
    if (src[i] === "\\") { i += 2; continue; }
    if (src[i] === "`") break;
    i++;
  }
  if (i >= src.length) throw new Error(`unterminated ${key} literal`);
  return src.slice(0, bodyStart) + esc(value) + src.slice(i);
}

function cleanPronounTag(t) {
  return t.replace(/,\s*she\/her(?=[,—)\s])/g, "").replace(/\bshe\/her,\s*/g, "");
}

const scenes = [];
for (const f of files) {
  const m = await load(f);
  scenes.push({ file: f, mod: m, id: m.id, orig: { text: m.text, textHot: m.textHot }, text: m.text, textHot: m.textHot, removedMeta: { text: [], textHot: [] }, removedParas: { text: 0, textHot: 0 } });
}

// Fixed-point loop so the result is stable (idempotent) even if stripping
// meta sentences makes further paragraphs identical across scenes.
for (let pass = 0; pass < 10; pass++) {
  let changed = false;
  const shared = sharedParagraphs(scenes, 3);
  for (const sc of scenes) {
    for (const k of ["text", "textHot"]) {
      const paras = splitParagraphs(sc[k]);
      const keptParas = paras.filter((p) => !shared.has(p) && !isStockPad(p));
      sc.removedParas[k] += paras.length - keptParas.length;
      const r = stripMeta(keptParas.join("\n\n"));
      sc.removedMeta[k].push(...r.removed);
      const next = cleanPronounTag(r.text);
      if (next !== sc[k]) { sc[k] = next; changed = true; }
    }
  }
  if (!changed) break;
}

// Closing-beat check: the "real" closing sentence is the last sentence after
// removing only padding paragraphs; flag scenes where meta-stripping removed it.
function realEnding(text, sharedSet) {
  const paras = splitParagraphs(text).filter((p) => !sharedSet.has(p) && !isStockPad(p));
  const last = paras[paras.length - 1] || "";
  const s = splitSentences(last);
  return s[s.length - 1] || "";
}
function lastSentence(text) {
  const paras = splitParagraphs(text);
  const s = splitSentences(paras[paras.length - 1] || "");
  return s[s.length - 1] || "";
}
const origShared = sharedParagraphs(scenes.map((s) => ({ text: s.orig.text, textHot: s.orig.textHot })), 3);

const rows = [];
const flags = [];
let totalBefore = 0, totalAfter = 0, touched = 0;
for (const sc of scenes) {
  const b = { w: wc(sc.orig.text), h: wc(sc.orig.textHot) };
  const a = { w: wc(sc.text), h: wc(sc.textHot) };
  totalBefore += b.w + b.h; totalAfter += a.w + a.h;
  const didChange = sc.text !== sc.orig.text || sc.textHot !== sc.orig.textHot;
  if (didChange) touched++;
  rows.push({ id: sc.id, warmBefore: b.w, warmAfter: a.w, hotBefore: b.h, hotAfter: a.h, changed: didChange });
  for (const [k, label] of [["text", "Warm"], ["textHot", "Hot"]]) {
    if (!sc[k].trim()) flags.push(`${sc.id} ${label}: EMPTY after strip`);
    else if (wc(sc[k]) < MIN_WARN) flags.push(`${sc.id} ${label}: only ${wc(sc[k])} words after strip`);
    const re = realEnding(sc.orig[k], origShared);
    const now = lastSentence(sc[k]);
    if (didChange && re && now !== re && now !== trimClauses(re)) flags.push(`${sc.id} ${label}: closing beat was meta and removed -> "${re.slice(0, 140)}" | now ends: "${now.slice(0, 140)}"`);
    const left = findMeta(sc[k]);
    if (left.length) flags.push(`${sc.id} ${label}: ${left.length} meta sentence(s) remain`);
    if (/she\/her/.test(sc[k])) flags.push(`${sc.id} ${label}: "she/her" remains`);
    if ((sc[k].match(/"/g) || []).length % 2) flags.push(`${sc.id} ${label}: odd number of quote marks`);
  }
}

if (!CHECK) {
  for (const sc of scenes) {
    if (sc.text === sc.orig.text && sc.textHot === sc.orig.textHot) continue;
    const p = path.join(DIR, sc.file);
    let src = fs.readFileSync(p, "utf8");
    src = replaceLiteral(src, "textHot", sc.textHot);
    src = replaceLiteral(src, "text", sc.text);
    fs.writeFileSync(p, src);
    const back = await load(sc.file);
    const same = (o) => JSON.stringify({ ...o, text: undefined, textHot: undefined });
    if (back.text !== sc.text || back.textHot !== sc.textHot || same(back) !== same(sc.mod)) {
      console.error("VERIFY FAILED for", sc.file);
      process.exit(1);
    }
  }
}

const pad = (v, n) => String(v).padStart(n);
console.log(`${"scene".padEnd(9)} ${"warm before".padStart(11)} ${"after".padStart(6)} ${"hot before".padStart(10)} ${"after".padStart(6)}`);
for (const r of rows) console.log(`${r.id.padEnd(9)} ${pad(r.warmBefore, 11)} ${pad(r.warmAfter, 6)} ${pad(r.hotBefore, 10)} ${pad(r.hotAfter, 6)}${r.changed ? "" : "  (unchanged)"}`);
console.log(`\nScenes: ${rows.length}, changed: ${touched}. Words before: ${totalBefore}, after: ${totalAfter}, removed: ${totalBefore - totalAfter}.${CHECK ? " (check mode: nothing written)" : ""}`);
if (flags.length) { console.log(`\nFlags (${flags.length}):`); for (const f of flags) console.log(" - " + f); }
if (process.env.STRIP_REPORT) fs.writeFileSync(process.env.STRIP_REPORT, JSON.stringify(scenes.map((s) => ({ id: s.id, removedMeta: s.removedMeta, removedParas: s.removedParas, endWarm: lastSentence(s.text), endHot: lastSentence(s.textHot) })), null, 2));
