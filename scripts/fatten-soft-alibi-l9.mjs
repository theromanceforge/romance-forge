#!/usr/bin/env node
/**
 * Write The Soft Alibi scene9a–scene9h from hand-written Warm + Hot prose in
 * scripts/soft-alibi-l9-parts/*.json.
 *
 * GUARDED (2026-09-24): the original version of this script reached the
 * 1500-word floor by appending stock padding paragraphs. That padding has been
 * stripped from the scenes (scripts/strip-soft-alibi-padding.mjs) and removed
 * from this script. It now:
 *   - never pads;
 *   - refuses to write ANY file unless every part has ≥1500 real words in both
 *     Warm and Hot, contains no stock padding paragraph, and has no planning /
 *     meta sentences (see scripts/lib/soft-alibi-clean.mjs).
 * The current parts are the pre-rewrite drafts and will fail these checks on
 * purpose, so re-running cannot overwrite the stripped scenes. Replace the parts
 * with the batched rewrite (docs/soft-alibi-rewrite-plan.md) before running.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { wc, findMeta, splitParagraphs, isStockPad } from "./lib/soft-alibi-clean.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, "../artifacts/stories/the-soft-alibi/scenes");
const PARTS = path.join(__dirname, "soft-alibi-l9-parts");
const LAYER = 9;
const MIN_WORDS = 1500;

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

const files = fs.readdirSync(PARTS).filter((f) => /^scene9[a-h]\.json$/.test(f)).sort();
if (files.length !== 8) {
  console.error("Expected 8 scene JSON parts, found", files.length, files);
  process.exit(1);
}

const problems = [];
const out = [];
for (const f of files) {
  const sc = JSON.parse(fs.readFileSync(path.join(PARTS, f), "utf8"));
  const warm = sc.warm.trim();
  const hot = sc.hot.trim();
  for (const [label, t] of [["warm", warm], ["hot", hot]]) {
    if (wc(t) < MIN_WORDS) problems.push(`${sc.id} ${label}: ${wc(t)} words (< ${MIN_WORDS}; padding is not allowed)`);
    if (splitParagraphs(t).some(isStockPad)) problems.push(`${sc.id} ${label}: contains stock padding paragraph`);
    const meta = findMeta(t);
    if (meta.length) problems.push(`${sc.id} ${label}: ${meta.length} planning/meta sentence(s), e.g. "${meta[0].slice(0, 90)}"`);
  }
  out.push({ sc, warm, hot });
}

if (problems.length) {
  console.error(`Refusing to write layer ${LAYER} (${problems.length} problem(s)); scenes left untouched:`);
  for (const p of problems) console.error(" - " + p);
  process.exit(1);
}

for (const { sc, warm, hot } of out) {
  const body = `export default {
  id: "${sc.id}",
  layer: ${LAYER},
  title: "${sc.title}",
  text: \`${esc(warm)}\`,
  textHot: \`${esc(hot)}\`,
  choices: ${JSON.stringify(sc.choices, null, 4).replace(/^/gm, "  ").trimStart()}
};
`;
  fs.writeFileSync(path.join(DIR, `${sc.id}.js`), body);
}
console.log(JSON.stringify(out.map(({ sc, warm, hot }) => ({ id: sc.id, warm: wc(warm), hot: wc(hot) })), null, 2));
