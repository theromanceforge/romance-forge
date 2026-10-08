// Usage: node echo-scan.mjs <repoRoot> [--json out.json] [--minWords N] [--story id] [--verbose]
import path from "node:path";
import fs from "node:fs";
const args = process.argv.slice(2);
const ROOT = path.resolve(args[0] || ".");
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const MINW = Number(opt("--minWords", 5));
const onlyStory = opt("--story", null);
const verbose = args.includes("--verbose");
const jsonOut = opt("--json", null);
const Q = await import(path.join(ROOT, "scripts/lib/story-quality.mjs"));
const SIM = 0.8;
const result = {};
for (const story of Q.STORY_IDS) {
  if (onlyStory && story !== onlyStory) continue;
  const scenes = await Q.loadStoryScenes(ROOT, story);
  const intra = [];
  const cross = new Map(); // key -> {sample, scenes:Set, hits:[]}
  for (const sc of scenes) {
    for (const field of ["text", "textHot"]) {
      const sents = [];
      for (const p of Q.splitParagraphs(sc[field])) for (const s of Q.splitSentences(p)) {
        const nw = Q.normWords(s);
        if (nw.length < MINW) continue;
        sents.push({ s, nw, key: nw.join(" "), sh: Q.shingles(nw) });
      }
      // within-version
      for (let i = 0; i < sents.length; i++) for (let j = i + 1; j < sents.length; j++) {
        const a = sents[i], b = sents[j];
        if (a.key === b.key || Q.jaccard(a.sh, b.sh) >= SIM) intra.push({ scene: sc.id, field, a: a.s, b: b.s, exact: a.key === b.key });
      }
      // cross-scene (exact normalized)
      for (const x of sents) {
        if (!cross.has(x.key)) cross.set(x.key, { sample: x.s, scenes: new Set(), hits: [] });
        const c = cross.get(x.key); c.scenes.add(sc.id); c.hits.push(`${sc.id}.${field === "text" ? "W" : "H"}`);
      }
    }
  }
  const overused = [...cross.values()].filter((c) => c.scenes.size >= 3)
    .map((c) => ({ sample: c.sample, n: c.scenes.size, scenes: [...c.scenes], hits: c.hits }))
    .sort((a, b) => b.n - a.n);
  result[story] = { intra, overused };
  console.log(`${story}: within-version repeats=${intra.length}  lines-in-3+-scenes=${overused.length}`);
  if (verbose) {
    for (const r of intra) console.log(`  [intra] ${r.scene}.${r.field}${r.exact ? "" : " ~"}: ${r.a.slice(0, 110)}${r.exact ? "" : "  ||  " + r.b.slice(0, 80)}`);
    for (const o of overused) console.log(`  [x${o.n}] ${o.sample.slice(0, 110)}  <- ${o.hits.join(" ")}`);
  }
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2));
