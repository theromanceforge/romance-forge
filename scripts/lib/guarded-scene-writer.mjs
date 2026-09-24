/**
 * Guarded scene writer: writes hand-written Warm + Hot scene prose from JSON
 * parts into artifacts/stories/<story>/scenes, but ONLY if every part passes
 * the same checks as tests/story-quality.test.js. It never pads.
 *
 * Part file shape (one per scene, <partsDir>/<sceneId>.json):
 *   { "id": "scene9a", "title": "...", "warm": "...", "hot": "...",
 *     "choices": [{ "id": "scene10a", "text": "...", "textHot": "..." }] }
 *
 * Refuses to write ANY file unless every part:
 *   - has >= minWords real words in both Warm and Hot;
 *   - has no paragraph repeated inside the part, and no paragraph shared
 *     with 2+ other scenes (story-wide padding check <= 5%);
 *   - has no planning / meta sentence and no meta or truncated choice label.
 */
import fs from "node:fs";
import path from "node:path";
import {
  wc, repeatedPadding, loadStoryScenes, findMetaHits, findLabelMeta, isTruncatedLabel, endingNamePatterns,
} from "./story-quality.mjs";

const esc = (s) => s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

export async function guardedWrite({ root, storyId, layer, partsDir, ids, minWords = 900, maxPadPct = 5 }) {
  const problems = [];
  if (!fs.existsSync(partsDir)) {
    console.error(`Refusing to write ${storyId} L${layer}: parts directory ${path.relative(root, partsDir)} does not exist.`);
    console.error("Write the batched rewrite (see docs/*-rewrite-plan.md) into that directory first.");
    process.exit(1);
  }
  const parts = [];
  for (const id of ids) {
    const f = path.join(partsDir, `${id}.json`);
    if (!fs.existsSync(f)) { problems.push(`${id}: missing part ${path.relative(root, f)}`); continue; }
    const p = JSON.parse(fs.readFileSync(f, "utf8"));
    parts.push({ ...p, warm: String(p.warm || "").trim(), hot: String(p.hot || "").trim() });
  }
  const current = await loadStoryScenes(root, storyId);
  const extra = endingNamePatterns(current);
  const byId = new Map(current.map((s) => [s.id, s]));
  for (const p of parts) {
    if (!byId.has(p.id)) problems.push(`${p.id}: not an existing scene id`);
    for (const [label, t] of [["warm", p.warm], ["hot", p.hot]]) {
      if (wc(t) < minWords) problems.push(`${p.id} ${label}: ${wc(t)} words (< ${minWords}; padding is not allowed)`);
      const meta = findMetaHits(t, storyId, extra);
      if (meta.length) problems.push(`${p.id} ${label}: ${meta.length} planning/meta sentence(s), e.g. "${meta[0].sentence.slice(0, 90)}"`);
    }
    for (const c of p.choices || []) for (const f of ["text", "textHot"]) {
      if (!c[f]) { problems.push(`${p.id}→${c.id}: empty ${f}`); continue; }
      if (isTruncatedLabel(c[f], byId.get(c.id)?.title)) problems.push(`${p.id}→${c.id} ${f}: truncated label "${c[f]}"`);
      if (findLabelMeta(c[f], storyId, extra).length) problems.push(`${p.id}→${c.id} ${f}: meta in label "${c[f]}"`);
    }
  }
  // story-wide padding with the parts swapped in
  const merged = current.map((s) => {
    const p = parts.find((x) => x.id === s.id);
    return p ? { ...s, text: p.warm, textHot: p.hot } : s;
  });
  for (const field of ["text", "textHot"]) {
    const { perScene } = repeatedPadding(merged, field);
    for (const p of parts) {
      const r = perScene[p.id];
      if (r && r.pct > maxPadPct) problems.push(`${p.id} ${field}: ${r.pct.toFixed(1)}% repeated-paragraph padding (> ${maxPadPct}%)`);
    }
  }
  if (problems.length) {
    console.error(`Refusing to write ${storyId} L${layer} (${problems.length} problem(s)); scenes left untouched:`);
    for (const p of problems) console.error(" - " + p);
    process.exit(1);
  }
  const dir = path.join(root, "artifacts/stories", storyId, "scenes");
  for (const p of parts) {
    const body = `export default {
  id: "${p.id}",
  layer: ${layer},
  title: ${JSON.stringify(p.title ?? byId.get(p.id).title)},
  text: \`${esc(p.warm)}\`,
  textHot: \`${esc(p.hot)}\`,
  choices: ${JSON.stringify(p.choices ?? byId.get(p.id).choices, null, 4).replace(/^/gm, "  ").trimStart()}
};
`;
    fs.writeFileSync(path.join(dir, `${p.id}.js`), body);
  }
  console.log(JSON.stringify(parts.map((p) => ({ id: p.id, warm: wc(p.warm), hot: wc(p.hot) })), null, 2));
}
