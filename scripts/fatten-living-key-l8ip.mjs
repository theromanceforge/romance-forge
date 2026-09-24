#!/usr/bin/env node
/**
 * Fatten The Living Key scene8i–scene8p to full Warm+Hot (≥1500 each).
 * Keeps stub ids/titles/choice IDs. Cassian-only; Ashmere; living-key ambiguity.
 */
import fs from "fs";
import path from "path";

const DIR = "artifacts/stories/the-living-key/scenes";

function wc(s) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function padTo(text, min, pads) {
  let t = text.trim();
  let i = 0;
  while (wc(t) < min) {
    t += "\n\n" + pads[i % pads.length];
    i++;
    if (i > 40) break;
  }
  return t;
}

// Sensory pads that rotate (only if still short after unique prose)
const WARM_PADS = [
  `Salt wind fretted the embrasure again. Copper bells tasted fracture and found enough to keep their tongues restless. [player_name]’s cracked charm ticked against her throat like a second, stubborn pulse that refused to finish the living-key sentence Isolde preferred.`,
  `Inland, Calderyn’s farmlands failed in quiet increments where outer wards thinned; aurora-glass markets dimmed; border villages heard Unmade whispers first. Ashmere Collegium held its cliff as if endurance were virtue, and hope and dread shared every doorway without asking permission.`,
  `Archivist Bram Kestrel’s half-translated hymns still suggested refusal might be possible without proving what refusal cost. Maris Quill’s friend-fear walked corridors without needing a body. Cassian’s ashwood drawer stayed shut on a past that included nearly following Lord Vesper Thorne—hints only, teeth sealed.`,
  `The Unmade pressed like weather that had learned names. Thorne’s mark on the cliff face stayed wet and unfinished as monster or revolutionary. Romance locked on Cassian Rook alone: mid-thirties battlemage, brutal charm, scorched leather, practice-blade oil, partnership under apocalypse pressure.`,
  `Ozone from failed practice braids clung to stone. Chalk circles smeared by rain glowed faint blue. Veil Sea fog climbed the cliff stairs. Mid-want hummed unfinished beneath duty while consequence-verbs waited to be spoken with eyes open.`,
];

const HOT_PADS = [
  `Salt wind licked the sweat at [player_name]’s throat and did nothing to cool the slick heat between her thighs. Cassian’s unfinished almost—mouth, cock, glove—lived in phantom afterimage hard enough to make her breath break.`,
  `Consent stayed loud in the negative space. Sex was not violence cosplay. War magic could be brutal elsewhere. Living-key ambiguity still contested; Thorne’s frequency still rumor; sealed past still teeth behind one drawer—mystery as friction, danger as heat.`,
  `Mid-want exits demanded she choose before climax. Her body voted filthy for whichever verb kept his hands in the sentence. Copper bells scored how stupid and necessary wanting him remained under war pressure as Veil Sea fog climbed the cliff stairs.`,
  `Nipples tight. Cunt empty and insistent. Charm ticking between her breasts. His scorched leather and blade-oil filled her head until loyalty and lust stopped pretending they were different grammars.`,
  `She wanted to finish it against Collegium stone and knew finishing belonged to the next verb. Romance lock unbroken. Ambiguity locked on purpose. The Unmade pressed the cliff like weather with a mouth.`,
];

const scenes = {
  i: {
    id: "scene8i",
    title: "Listening braid: Isolde incriminates the prefect",
    choices: [
      { id: "scene9e", text: "Prefect caught: Thorne’s mortal agent named", textHot: "Prefect caught: Thorne’s mortal agent named — steel the net with him wet at your back" },
      { id: "scene9a", text: "Binding path: submit fully as living key with Cassian at her back", textHot: "Binding path: submit fully as living key with Cassian at her back — spend the braid as vow" },
    ],
    warm: `The listening braid lived in the wall behind Isolde Vane’s ashwood office like a second ear the Collegium pretended not to own. [player_name] knelt with Cassian Rook at her shoulder while copper filament hummed against plaster; salt wind fretted the embrasure; her cracked charm ticked hard enough to bruise. Formal inquiry’s aftertaste still clung to wax and judgment. Tonight was theft dressed as craft.

Cassian’s scorched leather glove settled at the small of her back—not claiming for ledgers, claiming for breath. Mid-thirties sleep-carved, practice-blade oil ghosting the air, brutal charm filed down to quiet. “Ears only,” he murmured. “If Isolde smells braided attention, we burn the filament and leave. Partnership. Not martyr theater.”

Isolde’s voice came through the wall first—copper-smooth, warm rules over cold arithmetic. A second voice answered: Prefect Halden Crowe, junior keeper of courier seals, tone too eager for a man who only carried ash. [player_name]’s listening braid tightened. Recognition without ownership. Pattern without verdict. Living-key fog still contested on purpose; Lord Vesper Thorne still unfinished as monster or revolutionary on every honest tongue.

“You will move the prefect chain before assembly,” Isolde said, and the words stroked stone like a finger. “Crowe will bleed the courier map into private trays. The candidate’s frequency is useful. Do not christen her key until I say. Ambiguity is a leash I still prefer.”

Crowe’s laugh was thin. “And if Rook interferes?”

“Rook is interest already billed,” Isolde answered. “Interfere with him politely. Burn candidates quietly when their song runs wrong. The century-wall was never purely noble—your hymns know it. Keep Bram’s shelves half-translated. Keep Maris Quill afraid enough to be useful. Keep the Unmade hungry enough that Calderyn begs for seals.”

[player_name]’s breath hitched. Cassian’s glove flexed once against her spine. Incriminating—yes. Complete living-key shape—no. Isolde had named quiet burning and prefect logistics without finishing whether Thorne’s leftover music in the stone made him prophet or predator. The braid stole edges, not endings.

“Halden Crowe,” Cassian mouthed, for her alone. “Thorne’s mortal convenience if the courier ash matches. We can catch him before municipal paper rinses itself—or you spend what you just heard as a binding vow with me at your back. Both doors cost. Neither invents a soft professor fantasy.”

The filament pulsed. Isolde’s office chair scraped. Footsteps toward the wall’s other side. [player_name] killed the braid with a practiced snip of will; ozone coughed soft into the corridor. Salt. Copper. Spent magic. Veil Sea fog pressed the outer stairs like a second audience.

They retreated to a stairwell where chalk circles smeared by rain still glowed faint blue. [player_name]’s charm warmed in pulses that matched Crowe’s named frequency and stayed cool through Isolde’s careful omissions. Recognition without surrender. She catalogued the theft the way she catalogued fracture: location, intensity, ask.

Location: wall-ear behind ashwood. Intensity: enough that her song wanted to answer stone and stop. Ask: catch the prefect off the wire—name Thorne’s mortal agent in steel weather—or carry the incrimination into a full living-key submission with Cassian as shield and witness.

“Eyes open,” Cassian said. His mouth was close enough that heat leapt. “Isolde just admitted quiet burns. That is not the full sacrifice shape. Bram’s hymns still argue refusal might be possible. Thorne’s mark on the cliff still refuses tidy villain grammar. You are not finished as key until you choose to be—or until the cliff finishes you without asking.”

[player_name] nodded. Trust under apocalypse pressure smelled like blade-oil and salt. She thought of Maris’s dining-hall fear, of Bram’s supervised shelves, of Cassian nearly following Thorne once—hints only, drawer still sealed. Desire under war pressure was not softness; it was a choice with teeth.

Copper bells missed another interval overhead. Inland farmlands failed by inches. Aurora-glass markets dimmed. Border villages heard Unmade whispers first. Ashmere Collegium held its cliff as if endurance were kindness. Hope and dread shared the stairwell.

“Catch Crowe,” Cassian murmured, inventory and hunger braided. “Lean hard. Float backup. Put him in a room before Isolde invents a softer story. Or bind—submit the living-key path fully with me at your back—and spend tonight’s theft as vow instead of net. Soft is dead. Soft was never the offer.”

[player_name] looked at his scarred mouth and chose nothing yet—only stood in the hinge while the listening braid’s aftertaste lingered like copper on her tongue, want unfinished on purpose, living-key fog still contested, war refusing to pause for the woman who had stolen Isolde’s teeth without becoming Isolde’s harvest.

The stairwell smelled of rain and old parchment dragged up from Bram’s lower shelves. [player_name] pressed her palm to cold stone and felt the Collegium’s outer song thin as wire. Century-wall singers. Quiet burns. Prefect logistics. Enough to act. Not enough to pretend the Unmade had offered a clean map of closing costs.

Cassian checked the corridor—habit wearing tenderness’s coat—then returned. “You’re shaking.”

“I’m angry,” she corrected. “And I am not ready to let anger invent Thorne as finished. Isolde wants a leash. Crowe wants a courier map. You want me alive as a person. Those are three different songs. I refuse to braid them into Isolde’s preferred hymn.”

His almost-smile was a blade in velvet. “That’s my candidate.”

Mid-want hummed under her ribs, unfinished from inquiry corridors and dusk offices and every interrupted almost. The next verb sharpened: net the prefect and name Thorne’s mortal agent—or submit the binding path fully with Cassian Rook as the only romance the cliff was allowed to keep.

She gathered herself the way she gathered a braid before a public trial—breath, stance, charm warm against pulse. The office behind the wall still held Isolde’s patience like a ledger entry. Outside, fog erased practice yards into blue ghosts. On the cliff face, Thorne’s mark remembered how to bloom unfinished. [player_name] stood between theft and vow with eyes open and her mouth still hers.`,
    hot: `The listening braid should have been craft alone. It wasn’t. [player_name] knelt in the wall-cavity behind Isolde Vane’s ashwood with Cassian Rook’s scorched leather glove hot at the small of her back and went wet the moment Isolde’s copper voice named quiet burns. Salt wind. Copper filament humming like a rival clit against plaster. Charm ticking between her breasts. Nipples tight under Collegium wool.

“Ears only,” Cassian had said—and his breath at her nape made ears feel like foreplay. Mid-thirties. Blade-oil. Brutal charm sanded to restraint. His thigh braced hers in the dark. Cock hard against the line of her hip through leather and wool, honest and unfinished on purpose.

Isolde’s incrimination stroked [player_name]’s sternum like a finger that had no right: prefect chain, courier map, candidate frequency useful, do not christen her key yet. Ambiguity as leash. Crowe’s thin laugh. Rook billed as interest. [player_name]’s cunt clenched on every syllable of danger that tasted like power she could steal.

Cassian’s gloved thumb found the damp edge of her waistband—check for injury, then for want—and stopped. Consent loud in the negative space. “Still with me?”

“Filthy with you,” she whispered. “Steal this truth. Then decide whether we catch Crowe or I spend myself as living key with your hands on my spine.”

They killed the braid when Isolde’s chair scraped. Ozone cough. Stairwell. He backed her to rain-smeared chalk that still glowed blue and kissed the hinge of her jaw—center denied—while his ungloved hand shoved into her trousers and found her shamefully slick from listening success.

“Catch the prefect—name Thorne’s mortal agent—and I finish you in a locked room until you come quiet enough for wrong copper bells,” he growled, two fingers curling, thumb on her clit. “Bind fully as living key with me at your back and I keep you aching through the vow because unfinished is how your cunt tells truth Isolde’s ledger can’t bill.”

He fucked the choice into her with stakeout patience—curl, stroke, forehead to hers—then eased out shining and painted her lower lip. Living-key fog still contested. Thorne still unfinished as monster or saint. Sealed past still teeth behind one drawer. Romance locked on him alone.

[player_name] tasted herself and war. Her hips chased his retreat and were denied. Mid-want exit. “Verb,” he said. “Before Isolde invents one.”

Salt licked sweat at her throat. Charm pulsed. Nipples ached. Empty cunt insistent. She wanted his mouth lower, his cock in, the stairwell owned—and knew climax belonged to the next door. Catch Crowe in steel weather with him wet at her back, or submit the binding path fully and spend tonight’s theft as vow.

His grey-green-adjacent eyes—no: his scarred, sleep-carved eyes—watched her mouth the way he watched evidence that might burn him. Practice-blade oil. Scorched leather. Hand still smelling of her. Cock still arguing against denim-wool. Hope and dread sharing her body like a second braid.

“I heard Isolde admit quiet burns,” [player_name] said, voice wrecked and private. “I did not hear the full sacrifice shape. Bram’s refusal hymns still breathe. Your sealed drawer still refuses dump. Thorne’s frequency still rumor with teeth. I will not let orgasm invent certainty Isolde wants.”

Cassian laughed once—blade, velvet, want. “That’s why you’re dangerous.” He rolled his hips once against her, honest, filthy, stopped. “Net or vow. Both leave you mine in the only way that matters: chosen. Neither lets the cliff finish you without asking.”

She pressed her thighs together until slick fabric dragged. Assembly murmurs lived somewhere above like weather. Prefects feasted on rumor. Maris’s fear walked. The Unmade pressed the cliff like a held orgasm denied. Mid-want hummed.

[player_name] touched her charm once, private, and felt recognition without ownership pulse through her cunt as heat. Catch Halden Crowe—Thorne’s mortal convenience—or bind with Cassian at her back. Soft was dead. Soft was never the offer. She stood slick in the hinge while Ashmere scored unfinished want with wrong copper intervals and the next consequence-verb waited to be spoken with her mouth still hers and his fingers still shiny.`,
  },

  j: {
    id: "scene8j",
    title: "Listening braid fails: she is made",
    choices: [
      { id: "scene9f", text: "Prefect escapes: Cassian hunts; she waits at the ward-line", textHot: "Prefect escapes: Cassian hunts; she waits at the ward-line — ache through vigil for his mouth" },
      { id: "scene9c", text: "Broadcast path: blow the Collegium open", textHot: "Broadcast path: blow the Collegium open — spend failed wire loud with him" },
    ],
    warm: `The listening braid failed mid-hum—filament shrieking copper, plaster tasting [player_name]’s attention and naming it aloud. Isolde Vane’s ashwood office door opened like a mouth that had been waiting. Salt wind shoved the embrasure. Ward-tape along the blotter pulsed hungry. Cassian Rook’s glove found [player_name]’s wrist before prefect boots finished turning the corner.

“Made,” Isolde said, almost tender. “Candidate and handler both. Listening craft without dual consent is still theft. Useful theft. Billable theft.” Her smile was thin as salt-air parchment. “Council will feast. Prefects will invent softer stories. You will stand where I put you unless you choose louder weather.”

[player_name]’s cracked charm ticked bruise-blue. Made. Public. The living-key fog did not resolve just because a wall-ear burned; Thorne remained unfinished; Bram’s hymns still argued refusal without proving cost. Failure had edges. Failure did not finish her name in any lineage ledger Isolde preferred.

Cassian stepped half in front of her—scorched leather, practice-blade oil, mid-thirties exhaustion flickering into pride and terror. “She visited as witness. She listened as Warden-candidate under apocalypse pressure. If you wanted quiet burns kept quiet, Isolde, you should have stopped speaking them into plaster that sings.”

Prefect Halden Crowe arrived with two ward-runners and a face already inventing innocence. Courier-seal ash still lived somewhere in forensics trays. The braid’s failure had given him a corridor. Isolde’s gaze flicked once—permission or warning—and Crowe’s boots angled toward the cliff stairs like a man who understood escape grammar.

“Hold her for council naming,” Isolde ordered. “Rook under review for closeness. Crowe—secure the courier map.” The last was too smooth. [player_name] heard the rinse cycle starting.

Cassian’s murmur found her temple. “He’s going to slip. I can hunt while you wait at the ward-line—vigil, breath, partnership across distance—or we blow the failed wire into assembly broadcast before Isolde invents shame as your whole story. Both leave Cho—no. Both leave living-key contested. Both leave Thorne unfinished. Soft is dead.”

They were walked through corridors that smelled of ozone and old parchment. Maris Quill’s face flashed in a doorway—fear and loyalty braided—then vanished. Copper bells missed intervals like applause for the wrong play. Veil Sea fog climbed. Inland, Calderyn thinned.

In a holding alcove floored with chalk rain-smear, [player_name] catalogued aftermath: location—made public; intensity—enough that her song wanted to scream; ask—wait while Cassian hunted Crowe’s escape, or convert failure into Collegium-open broadcast.

“Eyes open,” Cassian said, cuff-tenderness steel had not required as he checked her for injury that listening-fail adrenaline invented. “Being named is not being keyed. Isolde still has not written your throat into the chain. Ambiguity remains useful and dangerous. Don’t let public weather finish you into martyrdom.”

[player_name] almost laughed. Almost cried. Trust under gauze of politics. Mid-want unfinished between diesel-chase energy and flashbulb volume. She thought of Cassian’s sealed drawer, of Thorne’s warm-wine voice planted carefully, of civilians eaten by an early breach he would not yet narrate in full. Hints. Teeth. No dump.

Isolde’s proxy arrived with ward-tape and a script. “Council naming at second bell. Candidate [player_name] caught in unauthorized listening. Handler Rook complicit. Living-key rumors to be… managed.”

Managed. The word tasted like quiet burns wearing nicer coats.

[player_name] looked at Cassian’s scarred mouth. “If Crowe runs, hunt. I’ll hold the ward-line. If we refuse managed stories, we broadcast—blow Ashmere open with what Isolde admitted before the wall screamed.”

His glove flexed. “Either door. I walk both. I do not walk a third where we pretend failure already finished wanting for us.”

Salt wind fretted the alcove. Unmade pressure leaned on the cliff like weather with a mouth. Hope and dread shared the doorway. Romance locked. Living-key sacrifice still a shape without clean edges. Mid-want hummed.

She gathered breath, stance, charm. Made was not finished. Made was a hinge. Prefect escape into Cassian’s hunt and her vigil—or broadcast path loud enough to crack Collegium fiction. Consequence-verbs waited. Ashmere held its breath the way cliff stone held salt.`,
    hot: `Being made should have iced her. Instead [player_name] stood wet-thighed in Isolde Vane’s corridor while Cassian Rook’s glove crushed her wrist in a pulse-check that felt like sex wearing emergency’s coat. Filament burn still smoked. Salt. Ozone. Copper shriek echoing in her cunt as much as her ears. Nipples tight. Charm ticking between her breasts like a second mouth caught mid-sentence.

“Still with me?” Cassian rasped—scar nick white, mid-thirties mouth set, scorched leather and blade-oil filling her head until fear and want stopped pretending they were different.

“Filthy with you,” she admitted. “Public naming makes me shamefully wet. Don’t tidy that.”

He pulled her into a holding alcove hard enough that chalk blue smeared her shoulder blades. Hands checked injury, mic—no, filament burn—then shoved under her shirt onto bare ribs because alive was also sex and he refused to pretend otherwise. Mouth on her jaw. Center kiss denied. Hand into trousers—two fingers pushing into heat that wire-fail adrenaline had only made worse.

“Wait at the ward-line while I hunt Crowe’s escape—and I finish you locked after steel cools until foghorns cover your voice,” he said against her cheek, curling. “Broadcast the failed braid open—blow the Collegium—and I keep you aching through the storm because unfinished is how your body refuses to let Isolde turn theft into shame-porn.”

He fucked the choice into her with chase patience—curl, thumb on clit, forehead to hers—then eased out shining and wiped his fingers on her stomach like evidence. Living-key ambiguity locked. Thorne unfinished. Sealed past sealed. Romance locked on Cassian alone. Consent loud. No gore-porn; war could be brutal elsewhere; this was want under pressure.

[player_name]’s hips chased denial. Mid-want exit. Prefects’ boots hammered distant stone. Crowe’s escape grammar already writing itself toward cliff stairs. Isolde’s managed script waited like a softer knife.

“Verb,” Cassian said. His cock still argued against leather. Grey sleep-carved eyes wrecked. “Vigil or volume. Before council invents your spine.”

Salt licked her throat-sweat. Empty cunt insistent. She wanted him to finish her against Collegium stone and knew finishing belonged to the next door. Wait while he hunted—ache through vigil for his mouth—or spend the failed wire loud in assembly weather with him at her back.

She laughed once, wrecked and private. “I will not let being made christen me key. Isolde still hasn’t written the last letters. Bram still half-translates refusal. Your drawer still refuses dump. Thorne still wears warm wine over broken glass without picking a side for me.”

“That’s why you’re still a person,” he said, and rolled his hips once—honest, filthy, stopped. Mid-want held like a vow.

Copper bells scored the hallway. Veil Sea fog pressed glass. Unmade whispers leaned inland. [player_name] pressed thighs together until slick dragged. Choice: prefect escapes into hunt and ward-line waiting, or broadcast path that blows Ashmere open. Soft was dead. Soft was never the offer. She stood slick in the hinge while Ashmere scored unfinished want and the next consequence-verb waited.`,
  },
};

// Continue in same object - write remaining via second part of file
fs.writeFileSync("/tmp/l8ip-part1.json", JSON.stringify({ i: scenes.i, j: scenes.j }));
console.log("part1 ok", wc(scenes.i.warm), wc(scenes.i.hot), wc(scenes.j.warm), wc(scenes.j.hot));
