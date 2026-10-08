// node occ.mjs <root> <story> <minScenes> [minWords] [filterRegex]
import path from "node:path";
const [root, story, ms = "3", mw = "5", filt] = process.argv.slice(2);
const Q = await import(path.join(path.resolve(root), "scripts/lib/story-quality.mjs"));
const scenes = await Q.loadStoryScenes(path.resolve(root), story);
const map = new Map();
for (const sc of scenes) for (const field of ["text", "textHot"]) {
  const ps = Q.splitParagraphs(sc[field]);
  ps.forEach((p, pi) => { const ss = Q.splitSentences(p); ss.forEach((s, i) => {
    const nw = Q.normWords(s); if (nw.length < +mw) return; const k = nw.join(" ");
    if (!map.has(k)) map.set(k, { scenes: new Set(), occ: [] });
    const m = map.get(k); m.scenes.add(sc.id);
    m.occ.push(`${sc.id}.${field === "text" ? "W" : "H"} p${pi}/${ps.length}: ${(ss[i - 1] || "¶").slice(-90)} >>${s}<< ${(ss[i + 1] || "¶").slice(0, 90)}`);
  }); });
}
const re = filt ? new RegExp(filt, "i") : null;
for (const [k, m] of [...map].filter(([, m]) => m.scenes.size >= +ms).sort((a, b) => b[1].scenes.size - a[1].scenes.size)) {
  if (re && !re.test(k)) continue;
  console.log(`\n### x${m.scenes.size} ${k}`); for (const o of m.occ) console.log("  " + o);
}
