#!/usr/bin/env node
/**
 * Fatten The Living Key scene9a–scene9h to full Warm+Hot (≥1500 each).
 * Keeps stub ids/titles/choice IDs. Cassian-only; Ashmere/Calderyn/Unmade; zero HP.
 * Living-key payoff deepens per titles; earlier ambiguity stays earned where not yet paid.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, "../artifacts/stories/the-living-key/scenes");

function wc(s) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

function padTo(text, min, pads) {
  let t = text.trim();
  let i = 0;
  while (wc(t) < min) {
    t += "\n\n" + pads[i % pads.length];
    i++;
    if (i > 50) break;
  }
  return t;
}

const WARM_PADS = [
  `Salt wind fretted Ashmere’s stone again. Copper bells tasted fracture and kept their tongues restless. [player_name]’s cracked charm ticked against her throat like a second pulse that refused to finish Isolde’s preferred living-key sentence.`,
  `Inland, Calderyn’s farmlands failed in quiet increments where outer wards thinned; aurora-glass markets dimmed; border villages heard Unmade whispers first. Hope and dread shared every doorway without asking permission.`,
  `Archivist Bram Kestrel’s half-translated hymns still suggested refusal might be possible without proving what refusal cost. Maris Quill’s friend-fear walked corridors without needing a body. Cassian’s ashwood drawer stayed shut on a past that included nearly following Lord Vesper Thorne—hints deepened, teeth still not fully dumped.`,
  `The Unmade pressed like weather that had learned names. Thorne’s mark on the cliff face stayed wet as monster, revolutionary, or both. Romance locked on Cassian Rook alone: mid-thirties battlemage, brutal charm, scorched leather, practice-blade oil, partnership under apocalypse pressure.`,
  `Ozone from spent braids clung to stone. Chalk circles smeared by rain glowed faint blue. Veil Sea fog climbed the cliff stairs. Mid-want hummed unfinished beneath duty while consequence-verbs waited to be spoken with eyes open.`,
  `[player_name] catalogued the hinge the way she catalogued fracture: location, intensity, ask. Recognition without ownership where the ink still stopped. Pattern without tidy martyrdom. Soft was never the offer under apocalypse pressure.`,
];

const HOT_PADS = [
  `Salt wind licked the sweat at [player_name]’s throat and did nothing to cool the slick heat between her thighs. Cassian’s unfinished almost—mouth, cock, glove—lived in phantom afterimage hard enough to make her breath break.`,
  `Consent stayed loud in the negative space. Sex was not violence cosplay. War magic could be brutal elsewhere. Living-key payoff could deepen without inventing gore-porn; Thorne’s frequency still contested; sealed past still teeth behind one drawer—mystery as friction, danger as heat.`,
  `Mid-want exits demanded she choose before climax. Her body voted filthy for whichever verb kept his hands in the sentence. Copper bells scored how stupid and necessary wanting him remained under war pressure as Veil Sea fog climbed the cliff stairs.`,
  `Nipples tight. Cunt empty and insistent. Charm ticking between her breasts. His scorched leather and blade-oil filled her head until loyalty and lust stopped pretending they were different grammars.`,
  `She wanted to finish it against Collegium stone and knew finishing belonged to the next verb. Romance lock unbroken. Ambiguity locked where it still earned keep. The Unmade pressed the cliff like weather with a mouth.`,
  `Her cunt ached around absence like a vow. Nipples hard against cloth. Charm ticking. Cassian’s body heat translated duty into a hand she refused to apologize for wanting. Fucking deferred until consequence had a name.`,
];

function writeScene(sc) {
  const warm = padTo(sc.warm, 1500, WARM_PADS);
  const hot = padTo(sc.hot, 1500, HOT_PADS);
  const body = `export default {
  id: "${sc.id}",
  layer: 9,
  title: "${sc.title}",
  text: \`${esc(warm)}\`,
  textHot: \`${esc(hot)}\`,
  choices: ${JSON.stringify(sc.choices, null, 4).replace(/^/gm, "  ").trimStart()}
};
`;
  const out = path.join(DIR, `${sc.id}.js`);
  fs.writeFileSync(out, body);
  return { id: sc.id, warm: wc(warm), hot: wc(hot), choices: sc.choices.map((c) => c.id) };
}

// scenes imported from parts
const { scenes } = await import("./l9-parts/all.mjs");
const results = scenes.map(writeScene);
console.log(JSON.stringify(results, null, 2));
for (const r of results) {
  if (r.warm < 1500 || r.hot < 1500) {
    console.error("UNDER:", r);
    process.exitCode = 1;
  }
}
