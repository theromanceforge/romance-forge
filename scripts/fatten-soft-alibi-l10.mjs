#!/usr/bin/env node
/**
 * Write The Soft Alibi scene10a–scene10j ending floors from hand-written
 * Warm + Hot prose in scripts/soft-alibi-l10-parts/*.json.
 *
 * - choices: [] locked (endings).
 * - No auto-padding: every ending must reach the ~800-word floor on its own.
 *   The script fails (exit 1) instead of filling with boilerplate.
 * - Idempotent: only writes artifacts/stories/the-soft-alibi/scenes/scene10*.js.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, "../artifacts/stories/the-soft-alibi/scenes");
const PARTS = path.join(__dirname, "soft-alibi-l10-parts");
const MIN_WORDS = 800;

function wc(s) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

const files = fs.readdirSync(PARTS).filter((f) => /^scene10[a-j]\.json$/.test(f)).sort();
if (files.length !== 10) {
  console.error("Expected 10 scene JSON parts, found", files.length, files);
  process.exit(1);
}

const results = [];
let failed = false;
for (const f of files) {
  const sc = JSON.parse(fs.readFileSync(path.join(PARTS, f), "utf8"));
  if (!Array.isArray(sc.choices) || sc.choices.length !== 0) {
    console.error("choices must be [] for", sc.id, sc.choices);
    process.exit(1);
  }
  const warm = sc.warm.trim();
  const hot = sc.hot.trim();
  const r = { id: sc.id, title: sc.title, warm: wc(warm), hot: wc(hot) };
  results.push(r);
  if (r.warm < MIN_WORDS || r.hot < MIN_WORDS) {
    console.error("UNDER FLOOR (not written):", r);
    failed = true;
    continue;
  }
  const body = `export default {
  id: "${sc.id}",
  layer: 10,
  title: "${sc.title}",
  text: \`${esc(warm)}\`,
  textHot: \`${esc(hot)}\`,
  choices: []
};
`;
  fs.writeFileSync(path.join(DIR, `${sc.id}.js`), body);
}
console.log(JSON.stringify(results, null, 2));
if (failed) process.exit(1);
