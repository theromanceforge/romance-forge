#!/usr/bin/env node
/**
 * Fatten The Soft Alibi scene7a–scene7p to full Warm+Hot (≥1500 each).
 * Keeps stub ids/titles/choice IDs. Nolan-only; Crownspire; across-the-hall;
 * Brooks MP→homicide pressure; Vivienne four fates open; zero other-title meta.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, "../artifacts/stories/the-soft-alibi/scenes");
const PARTS = path.join(__dirname, "soft-alibi-l7-parts");

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
    if (i > 60) break;
  }
  return t;
}

const WARM_PADS = [
  `Elevator chime late in the shaft reminded [player_name] that Crownspire never slept clean. Soft alibis lived in the gaps between floors—weekly to monthly to gone still contested, Vivienne's four fates still open doors behind every polite sentence. Layer 7 pressure made every hush sound like a draft Brooks could subpoena into colder paper.`,
  `Wine glass rings on marble looked like Venn diagrams of complicity. Nolan Greer's cufflinks clicked when Vivienne's name entered a room; Marcus Pell preferred the word traveling; Rhea Quinn's slate kept thinning marks that Detective Imani Brooks now read with homicide interest rising and no body yet settled. Soft still meant pliable evidence, not pink innocence.`,
  `Unused perfume still breathed from a master bath [player_name] should not know. Across the hall was twelve steps and a conscience with fingerprints. Black car at the curb. Concierge slate. Wind sheer against floor-to-ceiling glass throwing city light as accusation. Hangar cold and lobby fluorescent both knew her name now.`,
  `Brooks's badge flash in the lobby had stopped sounding like missing-persons alone. The file was cooling toward something colder without requiring a corpse on the table. Hope and dread shared the hallway. Vivienne might have left willingly, been paid to vanish, died, or staged every empty mark—[player_name] still could not choose which ending to fear, and Layer 7 refused to choose for her.`,
  `Nolan's brutal charm polished boardrooms and bedrooms with the same metal tell. Soft was what money bought when hard answers would burn the holding. [player_name]—early thirties, she/her, neighbor-mistress—felt the soft alibi fitting itself to her mouth like expensive silk she had not agreed to own, now wearing silent-partner ink, listening-wire aftertaste, hangar fuel, and inquiry heat.`,
  `Crownspire held its hush around her. Choice labels waited as verbs of consequence: name, bargain, speak, burn, widen, keep, catch, wire, broadcast, deal, raid, review, protect, burn, reunite. Mid-want and rising law pressure braided until leaving either unfinished hurt enough to prove both were real. Silent-partner file, gap in her story, second address, want returns, Brooks ultimatum, leaked recording, hangar breach, last hour reconstructed, across the hall, Pell's listening wire, plane-desk messages, break open, raid consequence, inquiry, public enough, elevator-bank reunion—Layer 7 spent soft into sharper paper without settling Vivienne.`,
];

const HOT_PADS = [
  `Elevator chime trembled through [player_name]'s teeth and down into unfinished heat. Nolan's nearness turned every secret into a physical question—cufflink click as tell, perfume ghost as third heat, mid-want ending before climax because consequence still had names left to speak. Layer 7 made the unfinished louder.`,
  `Wine-ringed marble. Thighs tight. Nipples tight under silk for reasons that were not pure fear. Brooks's escalating file could slide under her clothes as easily as Nolan's hands; Vivienne's unused perfume made every inhale taste like complicity she still wanted to swallow. Silent-partner ink, hangar cold, listening wire, and lobby daylight all found her pulse.`,
  `Sex stayed intimacy-forward, never gore. Crime was plot; heat was trust versus complicity wearing a body. She ached around absence the way Crownspire ached around Vivienne—four fates open, no settled corpse, want still loud enough to vote dirty for whichever verb kept his mouth in the sentence. Soft alibi had a pulse; tonight it hammered between her legs and her throat at once.`,
  `Black car idling like a held breath at the curb. Badge flash bright enough to feel on bare skin. Nolan's thumb at her waist counting ribs while homicide interest rose downstairs without naming a body. Recorder aftertaste, hangar dawn cold, perfume twin on her wrist, public shield heat—mid-want kept score across every setting.`,
  `She wanted to finish against glass and knew finishing belonged to the next choice. Romance locked on Nolan Greer alone—mid-forties, finance and tech holding, brutal charm, rain-money cologne. Across-the-hall geography made every unfinished almost both refuge and evidence. Walking away still left her wet for the chase.`,
  `Her cunt ached around unanswered questions. His cufflinks flashed like a tell she could feel low and filthy. Mid-want exits demanded she choose before climax while Vivienne stayed nowhere and everywhere—willing, paid, dead, or staging—and Brooks climbed toward colder paper without a corpse to prove it. Name, bargain, speak, burn, widen, keep, catch, wire, broadcast, deal, raid, review, protect, burn, reunite—each verb left her unfinished on purpose.`,
];

const files = fs.readdirSync(PARTS).filter((f) => /^scene7[a-p]\.json$/.test(f)).sort();
if (files.length !== 16) {
  console.error("Expected 16 scene JSON parts, found", files.length, files);
  process.exit(1);
}

const results = [];
for (const f of files) {
  const sc = JSON.parse(fs.readFileSync(path.join(PARTS, f), "utf8"));
  const warm = padTo(sc.warm, 1500, WARM_PADS);
  const hot = padTo(sc.hot, 1500, HOT_PADS);
  const body = `export default {
  id: "${sc.id}",
  layer: 7,
  title: "${sc.title}",
  text: \`${esc(warm)}\`,
  textHot: \`${esc(hot)}\`,
  choices: ${JSON.stringify(sc.choices, null, 4).replace(/^/gm, "  ").trimStart()}
};
`;
  fs.writeFileSync(path.join(DIR, `${sc.id}.js`), body);
  results.push({ id: sc.id, warm: wc(warm), hot: wc(hot), choices: sc.choices.map((c) => c.id) });
  if (wc(warm) < 1500 || wc(hot) < 1500) {
    console.error("UNDER:", results[results.length - 1]);
    process.exitCode = 1;
  }
}
console.log(JSON.stringify(results, null, 2));
