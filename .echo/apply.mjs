// node apply.mjs <root> <rulesModule.mjs>
// rules: export default [{story, scene, find, repl, fields?:["text","textHot"], n?: expected total count}]
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
const [root, rulesFile] = process.argv.slice(2);
const ROOT = path.resolve(root);
const Q = await import(path.join(ROOT, "scripts/lib/story-quality.mjs"));
const rules = (await import(pathToFileURL(path.resolve(rulesFile)).href + "?t=" + Date.now())).default;
const SA_LOCK = (id) => { const m = /^scene(\d+)([a-z]?)$/.exec(id); if (!m) return true; const n = +m[1]; return n > 7 || (n === 7 && m[2] >= "n"); };
let errors = 0, applied = 0;
const byFile = new Map();
for (const r of rules) {
  if (r.story === "the-soft-alibi" && SA_LOCK(r.scene)) { console.error("LOCKED SA scene", r.scene); errors++; continue; }
  const file = path.join(ROOT, "artifacts/stories", r.story, "scenes", r.scene + ".js");
  if (!byFile.has(file)) byFile.set(file, []);
  byFile.get(file).push(r);
}
for (const [file, rs] of byFile) {
  const mod = (await import(pathToFileURL(file).href + "?t=" + Date.now() + Math.random())).default;
  const vals = { text: mod.text, textHot: mod.textHot };
  let ok = true;
  for (const r of rs) {
    const fields = r.fields || ["text", "textHot"];
    let total = 0;
    for (const f of fields) total += vals[f].split(r.find).length - 1;
    const exp = r.n ?? null;
    if (total === 0 || (exp !== null && total !== exp)) { console.error(`COUNT ${total} (exp ${exp ?? ">=1"}) ${r.story}/${r.scene}: ${r.find}`); errors++; ok = false; continue; }
    for (const f of fields) vals[f] = vals[f].split(r.find).join(r.repl);
    applied++;
  }
  if (!ok) continue;
  let src = fs.readFileSync(file, "utf8");
  if (vals.text !== mod.text) src = Q.replaceSceneField(src, "text", vals.text);
  if (vals.textHot !== mod.textHot) src = Q.replaceSceneField(src, "textHot", vals.textHot);
  fs.writeFileSync(file, src);
  // verify
  const chk = (await import(pathToFileURL(file).href + "?v=" + Date.now() + Math.random())).default;
  if (chk.text !== vals.text || chk.textHot !== vals.textHot) { console.error("VERIFY FAIL", file); errors++; }
}
console.log(`applied ${applied} rules, errors ${errors}`);
if (errors) process.exit(1);
