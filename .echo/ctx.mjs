// node ctx.mjs <root> <story> <sceneId> <field W|H> <substring> [paraContext=1]
import path from "node:path";
const [root, story, sid, f, sub, c = "1"] = process.argv.slice(2);
const Q = await import(path.join(path.resolve(root), "scripts/lib/story-quality.mjs"));
const scenes = await Q.loadStoryScenes(path.resolve(root), story);
const sc = scenes.find((s) => s.id === sid);
const field = f === "H" ? "textHot" : "text";
const ps = Q.splitParagraphs(sc[field]);
const C = Number(c);
ps.forEach((p, i) => { if (p.includes(sub)) { console.log(`--- ${sid}.${f} para ${i}/${ps.length} [${sc.file}]`); for (let k = Math.max(0, i - C); k <= Math.min(ps.length - 1, i + C); k++) console.log((k === i ? ">> " : "   ") + ps[k] + "\n"); } });
