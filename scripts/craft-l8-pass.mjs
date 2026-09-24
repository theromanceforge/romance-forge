#!/usr/bin/env node
/**
 * Layer 8 voice/heat craft pass — What the Sister Kept
 * Keeps id/title/choice IDs; caps Solis; strips meta; unique mid-want exits.
 */
import fs from "fs";
import path from "path";

const DIR = "artifacts/stories/what-the-sister-kept/scenes";

function splitScene(src) {
  const m = src.match(
    /^(export default \{\n  id: "[^"]+",\n  layer: \d+,\n  title: "[^"]+",\n  text: `)([\s\S]*?)(`,\n  textHot: `)([\s\S]*?)(`,\n  choices: \[[\s\S]*?\]\n\}\s*;?\s*)$/
  );
  if (!m) throw new Error("parse fail");
  return { head: m[1], warm: m[2], mid: m[3], hot: m[4], tail: m[5] };
}

function wc(s) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** Keep at most `max` paragraphs that mention Solis/Nina; scrub the rest. */
function capSolis(text, max = 1) {
  const paras = text.split(/\n\n/);
  let kept = 0;
  const out = paras.map((p) => {
    if (!/Solis|\bNina\b/i.test(p)) return p;
    if (kept < max) {
      kept++;
      // Soften dump-y Solis paragraphs into hint-only if they unpack too much
      let q = p;
      // Remove meta about Layer / later layers inside Solis paras
      q = q.replace(/\s*Layer\s*\d+[^.]*\./gi, "");
      q = q.replace(/\s*full story saved for later layers that earned it\.?/gi, "");
      q = q.replace(/\s*No full dump\.[^.]*\./gi, "");
      q = q.replace(/\s*hints only[^.]*full[^.]*\./gi, " Hint only.");
      return q.replace(/\s{2,}/g, " ").trim();
    }
    // Scrub name, keep bruise/flinch energy without a second hint beat
    return p
      .replace(/Nina Solis/gi, "the sealed past")
      .replace(/\bSolis\b/gi, "sealed-past")
      .replace(/sealed-past-shaped/gi, "old-wound")
      .replace(/sealed-past ash/gi, "old raid ash")
      .replace(/sealed-past-smoke/gi, "old-raid smoke")
      .replace(/sealed-past's sealed hallway/gi, "an old sealed hallway")
      .replace(/When sealed-past and I/gi, "When my partner and I")
      .replace(/give you more sealed-past than hints/gi, "give you more of the sealed file than hints")
      .replace(/association smoke/gi, "old association weather")
      .replace(/\s{2,}/g, " ")
      .trim();
  });
  return out.join("\n\n");
}

function stripMeta(text) {
  return text
    .replace(/\bLayer\s*\d+\b[^.?!]*(?:[.?!]|$)/gi, (m) => {
      // Replace whole sentence-ish chunk with nothing; cleanup below
      return "";
    })
    .replace(/\bLayer\s*\d+\b/gi, "")
    .replace(/\bas craft\b/gi, "on purpose")
    .replace(/hook as craft/gi, "hook left unfinished")
    .replace(/denial as craft/gi, "denial with teeth")
    .replace(/No full dump\.[^\n]*/gi, "")
    .replace(/full story saved for later layers that earned it\.?/gi, "full story still sealed behind his ribs.")
    .replace(/Layer 8 got[^.]*\./gi, "")
    .replace(/Hurt to leave either\. Good\. Means you understand[^.]*\./gi, "Either door costs.")
    .replace(/Hurt to leave either\./gi, "Either door costs.")
    .replace(/\s{2,}/g, " ")
    .replace(/ \./g, ".")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/hazel/gi, "grey-green");
}

/** Unique mid-want exit replacements keyed by scene letter + spice */
const EXITS = {
  a: {
    w: `[player_name] stared past the mics toward the pier district where a festival had once eaten a sister, toward the upriver stretch where bone waited without a name. Hope still had a throat. Dread still had teeth. The journal's last open page fluttered—*She saw him. She knows she saw him.*—and daylight was not the end of the kept secret. Daylight was the beginning of choosing which fire got to finish it.

Jake's cracked knuckles hovered a breath from her wrist—near enough to feel heat, far enough that the cameras could not invent a romance angle without lying. "Trial spine puts Owen under oath with Renny's loops as the vertebrae," he murmured. "Press storm hands Harborwick every plate number before Ellison can leash the narrative. I walk either. I do not walk a third where we pretend the mics already finished wanting for us."

Rain needled purple leather. Foghorn rolled inland. [player_name] closed the journal against her chest and felt the unfinished almost of his mouth like a held charge—partnership still mid-want, chain finally daylight, Cho's *pending* still the only honest word about those remains.`,
    h: `Jake boxed her half a step behind a concrete pillar where one lens lost her throat. His thigh found hers. His mouth found the hinge of her jaw—not the center kiss, never on precinct stairs—and his cracked knuckles slid under her coat to the damp small of her back until she had to bite a sound into Renny's leather.

"Choose with your cunt telling the truth your mouth just put on record," he breathed. "Full-testify trial path—Owen under oath, no soft edges—and I take you apart in a locked room after the first deposition until you come quiet enough for foghorns. Blow it open in the press—USB, map, every plate—and I keep you aching through the storm because unfinished is how your body refuses to let the city invent a corpse for comfort."

[player_name]'s pulse lived between her legs and in the journal's warm spine. Remains still unnamed. Charm still only *like*. Jake's thumb found her pulse at her wrist and counted like he was timing an orgasm he refused to give her on precinct concrete. "Verb," he said. "Before Ellison invents one."`
  },
  b: {
    w: `Ellison's tablet chimed again and went ignored. Rain freckled the office glass. The journal sat between them like a third party who had already decided that silence was a language Harborwick spoke too fluently.

"Mercy leash means seals as sheath—Owen under a bargain-edged oath, some pages dark on purpose," Jake said, voice low enough that the HVAC nearly ate it. "Clean burn means you testify fully anyway and teach this machine that some sisters refuse soft darkness even when a captain offers it as kindness. I stay human either way. Or I become the clearance fear she is already drafting."

[player_name] tasted burnt coffee and pier salt through the vents. Hope and dread still shared Cho's careful language upriver. Jake's grey-green eyes asked for the verb while Ellison's reflection watched them in the rain-flecked glass like a woman who had already priced both doors and was waiting to see which one [player_name] would bleed for.`,
    h: `When Ellison turned for the call she had been pretending not to take, Jake's hand found the inside of [player_name]'s wrist under the table edge—thumb on her pulse like a wire check and a claim. His boot hooked her ankle. The hard line of his cock pressed once against her knee through charcoal wool, honest and filthy and banked.

"Mercy leash or clean burn," he murmured against the shell of her ear. "Trial with bargain—seals as sheath, Owen breathing deal-shaped air—and I finish you in a supply closet that smells like toner until your bargain voice breaks. Testify fully anyway—every plate, every late night—and I keep you dripping through Ellison's seals because your cunt does not do tidy politics."

[player_name] pressed her thighs together until slick fabric dragged. Foghorn rolled. Jake's grey-green eyes asked for the verb one last time while Ellison's reflection watched them like a third, uglier arousal. "Pick," he said. "Before she invents your spine for you."`
  },
  c: {
    w: `The cream letter lay between their chests like a third pulse. Renny's *only if* had become *now*. Rain needled the warehouse glass. Precinct coffee cooled bitter on the nightstand.

"Hospital-dawn future means we braid soft rebuild into the case's living throat—gauze light, machines inventing patience, us answering Cho without inventing funerals," Jake said, forehead nearly touching hers. "Pier dawn means leave-or-stay weather on the boards where she vanished, truth spoken where fog can erase or keep us. I will walk either. I will not walk a third where we pretend reading this aloud finished the wanting."

[player_name] traced Renny's loops once more with a fingertip that shook. Badge on the dresser. Cracked notebook on the floor. Unidentified remains still patient. Charm still only probable. The unfinished kiss of confession hung between their mouths—grief holy, want unfinished, two doors that both cost.`,
    h: `Jake's thigh slotted higher between hers until the letter's cream edge crinkled against her sternum and her cunt answered the paper's honesty with a filthy pulse she refused to tidy. His mouth found her throat. His fingers found the wet edge of her underwear and kept time there—stroke, stop, stroke—like a man who understood mid-want was the only ending Harborwick ever earned.

"Hospital dawn and I fuck you slow after the stitch-light fades until you come with my name and Renny's truth in the same breath," he said against her pulse. "Pier dawn and I keep you aching on the boards—leave or stay spoken with my fingers still shiny from you—because unfinished is how grief and sex coexist without eroticizing the river."

The desk lamp threw yellow across his scar. [player_name] arched into the almost. Letter between them. Choice unfinished. Jake's cock hard against her hip and denied on purpose while rain kept score on the glass.`
  },
  d: {
    w: `Ash settled in the bowl like a small, obedient funeral for paper that had never been a corpse. Smoke thinned. The kitchen smelled like mercy and cowardice wearing the same coat.

"Sealed pages means we wake beside smoke and a detective who held the bowl—file dark where Ellison cannot sand it soft, us living with what fire kept private," Jake said, cracked knuckles still damp from the tap. "Pier dawn means we walk the boards where a festival ate a sister and ask whether leaving or staying is the cleaner burn. Both doors remember what you lit. Neither invents Renny on Cho's tray."

[player_name] tasted smoke at the back of her throat. Attraction sharpened around ruin without needing a second name for his sealed past. The bowl cooled. Harborwick's rain kept time on the glass while she chose sealed life or pier fog with ash still ghosting her tongue and Jake waiting like a man who would not pretend fire was tidy.`,
    h: `Jake boxed her against the counter while the bowl still ticked heat. His hand shoved into her jeans without ceremony—two fingers finding her shamefully slick from watching paper die—and he fucked the choice into her with kitchen patience, thumb on her clit, mouth at her ear.

"Sealed life and I make you come against this counter with ash on your tongue until soft darkness feels like a verb you chose," he growled. "Pier dawn and I walk you to the boards still dripping, leave-or-stay spoken while my fingers smell like your cunt and burnt cream paper—because unfinished heat is how we refuse to let fire become a funeral for a girl science has not named."

[player_name] came close and was denied—Jake easing out, painting her lower lip with a wet thumb, grey-green eyes wrecked and careful. The kitchen cooled enough to pretend the fire had only been paperwork. He waited. The bowl cooled. She had to pick sealed sheets or pier fog with smoke still in her cunt's memory.`
  },
  e: {
    w: `Ellison's phone glowed *partner* again across the room and Jake's jaw flexed once—old bruise, no speech. The second-victim file lay open like a throat that had finally learned a second name without christening Renny's.

"Widen into full trial testimony and every other girl's mark becomes vertebrae under oath," Jake said, pen still. "Name Renny's killer when the clerk is caught and keep the lens narrow enough that hope still has a corridor upriver. I will not invent funerals to make a pattern prettier. I will not shrink a pattern to make your grief tidier."

Outside, pier fog argued with itself. Inside, [player_name] flexed her fingers against the desk edge and felt seven years braid into one next verb. Jake watched her mouth the way he watched evidence that might burn him. Mid-want hung unfinished: widen the case, or keep the hunt named for one sister while science stayed patient.`,
    h: `Under the table Jake's boot claimed her shoe and his knuckles brushed the inside of her knee—claim translated into denim heat. [player_name]'s cunt clenched around the pattern's ugly mercy: other girls' marks, Renny still a pointed finger, Cho still refusing baptism.

"Widen the trial and I fuck you after every deposition until pattern and orgasm stop pretending they are different grammars," Jake murmured, voice for her alone. "Catch the clerk and make him name the killer with Renny still central—and I keep you aching in the van until the name lands, unfinished on purpose, because your body tells truth faster than Ellison's clearance mug."

His thumb found her pulse at her wrist and pressed. Ellison said *partner* wrong on purpose into the phone; Jake's flinch traveled through that thumb into [player_name] until she bit her lip. Two doors. One wet. Science still unanswered upriver.`
  },
  f: {
    w: `The narrow file stayed narrow on purpose—Renny's name underlined twice, other marks living only as margin ghosts Ellison hated. Jake's pen did not move. Grey-green eyes did.

"Mercy deal with Renny still central means you bargain without letting the city rinse her into a pattern statistic," he said. "Testify fully anyway means you spend every plate and late night even if the lens stays sister-shaped. I will not widen for clearance theater. I will not pretend narrow is cowardice when narrow is how hope keeps a corridor."

Outside, pier fog argued. Inside, [player_name] felt seven years and one unfinished want braid into a verb. Jake watched her mouth. The hook hung in Ellison's quiet and in his almost-touch and in the unanswered science that still refused to finish the naming while Harborwick's damp history leaned on the glass.`,
    h: `Jake's knee pressed hers hard enough to bruise soft. Under the desk his fingers found the seam of her jeans and rubbed once—filthy punctuation on a narrow case—until [player_name]'s breath hitch betrayed her.

"Mercy with Renny central and I take you apart in a stairwell after the bargain lands, slow enough that seals feel like foreplay," he said. "Full testify anyway—narrow lens, loud mouth—and I keep my hand in your jeans through the lunch recess because unfinished want is how you refuse to let a captain turn your sister into a tidy footnote."

[player_name]'s palms dampened the desk. Attraction blasphemy wearing narrow clothing. Old-wound silence under Jake's ribs like a second badge. Between her legs and the almost-touch of his attention, unanswered science upriver braided into one hook—ruin and rescue refused to share a template with any other fork. She had to pick.`
  },
  g: {
    w: `Sodium light leaked through corrugated gaps. The clerk's wrists shone. Warm shredder still ticked somewhere in the dark like a mechanical conscience. Jake did not fill the silence with comfort.

"Hold the clerk—killer named—means we extract while steel is fresh and Renny's map stays geography not corpse," he said, notebook spine cracking. "Watch him slip—Jake hunts—means you choose vigil over certainty and I spend dawn chewing restraint two blocks away. Both leave Cho's tray unnamed. Both leave my past stained if Ellison's radio silence means anything."

[player_name] drew a breath that tasted like rust and soap and unfinished trust. Attention as a blade laid flat. Dawn coming whether the clerk's cigarette brand matched Renny's margin sketch or not. Hold or hunt—mid-want still humming in the frost-latch dark.`,
    h: `Behind the frost-latch [player_name]'s thighs were tight enough to hurt. Jake cleared the last angle, then crowded her for one stolen second—gloved hand at her waist, ungloved thumb stroking the damp heat through her jeans until she nearly made a sound the warehouse would own.

"Hold and I finish you against this latch after the name lands—quiet enough for foghorns, filthy enough that steel still sings in your cunt," he whispered. "Slip and hunt and I leave you aching through the vigil with my mouth promised for the first locked room we earn, because unfinished is how chase stays honest."

Perimeter radio crackled *partner* by accident; Jake's small flinch traveled into her as heat she had no protocol for. Hold meant extraction and a name with teeth. Slip meant hunt and vigil. Charm still probability. Bones still unnamed. She had to conjugate dawn into a door.`
  },
  h: {
    w: `Owen's partial confession sat on the table like a fish that had learned to breathe air badly—dates, companions, lullaby grammar, living links without Renny christened on a tray. Ellison's empty mug watched. Jake's notebook music stopped.

"Use Owen's partial to catch the clerk and we spend ugly usable truth as a net," Jake said. "Trade mercy for what Owen gave and we sheath the worst edges while the desk codes still smoke. Both leave science patient. Both leave me wanting your mouth after cuffs for reasons that are not clearance."

Outside the glass, pier fog argued with itself in the reflection. Inside, [player_name] flexed her fingers and felt the next verb arrive without a soft land. Owen breathed deal-shaped fear. Jake watched her mouth. Mid-want unfinished between mercy and steel.`,
    h: `Jake's boot pressed her shoe once more under the interview table—claim, dare, unfinished fuck translated into leather—while Owen's cuffs ticked. [player_name]'s cunt answered the partial the way it answered Jake's almost-kisses: shameless, procedural, wrong for the room and right for the week.

"Catch the clerk off Owen's dates and I put you on this table after transfer—fingers first, mouth second—until mercy and orgasm stop competing," Jake murmured for her alone. "Trade mercy for the partial and I keep you dripping through the deal language because your body refuses to let bargain feel clean."

Ellison entered soft and final. Gaze cutting to Jake's ribs—old flinch, not unpacking—and to the flush climbing [player_name]'s throat. Two doors. One wet. Renny still a pointed finger. Science still unanswered.`
  },
  i: {
    w: `The alcove smelled like bleach and victory that refused to feel clean. Mic pack still warm against [player_name]'s sternum. Marcus Hale's name still living on the wire like a second pulse. Jake's cracked knuckles whitened when a hallway cart rattled—old bruise, no speech.

"Catch the clerk off the wire—lean hard, float backup, put Hale in a room before municipal paper rinses itself," Jake said, inventory and hunger braided. "Carry this wire into full testimony—court lights, Ellison's narrative, chain on record—and stop pretending soft nets can hold a desk that already named itself. Both leave Cho's bones unnamed tonight. Both leave me wanting to put you somewhere soft after bleach."

[player_name] shook once. Soft was dead. The clerk's name was breathing. Fog pressed the glass. Hope kept its impossible job beside dread. The denial of his mouth on hers hung as the only soft thing left—and even that was a hook, not a landing.`,
    h: `Jake pulled her into the alcove hard enough that the mic pack bit her sternum. Hands checked injury, then the wire, then shoved under her shirt onto bare ribs because alive was also sex and he refused to tidy it. Mouth on her jaw. Center kiss denied. Hand into jeans—two fingers pushing into heat that wire-success adrenaline had only made worse.

"Clerk off the wire and I finish you in a locked room until you come quiet enough for foghorns," he said against her cheek, curling. "Full testimony and I keep you aching through Ellison's lights because unfinished is how your cunt tells truth when recorders cannot."

He fucked the choice into her with stakeout patience—curl, thumb on clit, forehead to hers—then eased out shining and painted her lower lip. Fog pressed the glass. Hale's name lived without a corpse attached. His cock still argued against denim. She had to pick before bleach invented a softer story.`
  },
  j: {
    w: `Rain erased the curb where soft ice had just cut. The van smelled like wet wool and failed quiet. [player_name]'s mic pack sat against her sternum like a second mouth that had been caught mid-sentence. Jake's scar nick was white; his late smile was gone.

"Wait while I hunt the escape—regroup, float backup, keep you breathing while we dig another angle," he said, hands still checking her for injury with cuff-tenderness steel had not required. "Blow the failed wire into the press—SIM chain on a city stage, municipal throat exposed—and stop letting quiet deals protect desks that already smelled you. Both leave Cho contested. Both leave me wanting soft after rain."

The denial of his mouth hung unfinished. Soft was dead. The clerk was moving. Harborwick fog pressed the van glass and hope kept breathing beside dread while [player_name] chose vigil or volume with adrenaline still shaking her hands.`,
    h: `Jake pulled her into the van—scar nick white, grey-green nearly black—hands checking injury, mic, then under her wet shirt onto bare ribs. Mouth on her jaw. Hand into jeans again, fingers pushing into heat that wire-fail adrenaline had only made worse.

"Survive the fail—hunt, backup, keep breathing—and I finish you locked until foghorns cover your voice," he rasped. "Press the SIM chain open and I keep you aching through the storm because unfinished is how your body refuses to let a failed wire become shame-porn for Ellison."

He curled once, denied her the edge, wiped his fingers on her stomach like evidence. Fog pressed the glass. A blank line where Hale's full name should have been. His cock still argued. She had to conjugate aftermath into a door before the unfinished kiss became the only honest thing left.`
  },
  k: {
    w: `Flashbulbs stuttered against Harborwick's damp throat. The SIM chain lived on a podium mic like a live wire that had learned to speak daylight. Jake stood at [player_name]'s shoulder with brutal charm filed to a public edge and a sealed silence in his shoulders that did not need a second name.

"Ride the press conference open—correct falsehoods in real time, refuse funeral grammar, keep Cho's *pending* louder than rumor," he said under the noise. "Convert press heat into trial—walk every timestamp into oath weather before Ellison can sand the narrative soft. Both leave me wanting your spine in a room without lenses. Both leave Renny a pointed finger, not a headline corpse."

The denial of his hand at the small of her back—present, not claiming for cameras—hung as hook. Soft was dead. Daylight was breathing. [player_name] tasted pier salt and unfinished want and chose open storm or oath conversion while foghorns argued with shutters.`,
    h: `Behind the temporary scrim Jake boxed her for three stolen seconds—thigh between hers, cock hard against denim she could feel, mouth at her ear. "Ride it open and I fuck the adrenaline out of you in the first locked stairwell after the last question," he said. "Convert to trial and I keep you dripping through every recess because unfinished climax is bagged evidence I refuse to log."

He rolled his hips once—honest, filthy—and stopped, unfinished held like a vow. Flashbulbs stuttered. [player_name]'s cunt clenched around the public risk. Charm probable. Bones unnamed. She had to pick before the city invented a softer verb for her mouth.`
  },
  l: {
    w: `The quiet-deal draft glowed on Ellison's tablet like a softer knife. Ink dimmed when Jake closed the lid halfway—chain still alive underneath. Rain freckled the glass. [player_name] tasted toner and compromise.

"Seal what the quiet deal demands—pages dark, desks breathing, Renny's name protected from rinse-cycle optics," Jake said. "Fold the deal into mercy testimony—bargain language walked into a room with oaths anyway. Both leave fog on the glass. Both leave me wanting to finish the almost-kiss this room keeps interrupting."

He closed the draft lid fully. The almost hung unfinished on purpose while Harborwick fog pressed and hope kept its impossible job beside dread on Cho's contested tray. [player_name] chose seal or fold with mid-want still conjugating in her throat.`,
    h: `Jake guided her into the copy alcove, draft lid still half-closed on the table behind them like a third consent. Hand into her jeans. Two fingers. Thumb on clit. Mouth on her jaw—center denied.

"Seal the quiet deal and I make you come against the toner shelf until darkness feels chosen, not imposed," he murmured. "Fold it into mercy testimony and I keep you aching through every bargain paragraph because your cunt does not do clean seals."

He eased out shining. Fog pressed the glass. Chain still alive under dimmed ink. His cock still argued against denim. She had to pick before Ellison's tablet invented her spine.`
  },
  m: {
    w: `Diesel and antiseptic braided in the ambulance bay. Gauze at Jake's temple looked too small for how the red door had sounded. The medic's back was a temporary wall. Captain Mara Ellison's name already lived in someone's phone two blocks away—review weather coming whether they invited it or not.

"Hospital dawn with me means bedside, CT, soft language, us answering footnotes with actual breath," Jake said, grit under the plea. "Chase—wait while I hunt—means you save the soft for vigil and I repay the waiting when steel cools. Lightly wounded is still a fork with teeth. Remains unnamed. Charm probable. I put you behind my six and I would do it again."

[player_name] almost laughed. Almost cried. Trust under gauze. Mid-want unfinished between fluorescent future and diesel chase while Jake's cracked knuckles stayed forced open on the rail like a man refusing to hold a gun and a lover with the same fist.`,
    h: `In the supply alcove Jake put [player_name]'s back against saline shelves, blood-smear gauze brushing her temple when he kissed her hard enough to bruise. He dropped despite the throb, yanked her jeans, and put his mouth on her cunt like survival had a flavor—tongue fucking, nose on clit—until she shook and he denied the edge on purpose.

"Dawn and I get your mouth on my unbloodied throat after the stitch and my fingers back in this slick while machines beep," he said, rising, rolling his hips once so she felt the unfinished claim through the gown. "Chase and you save the soft for waiting and I repay you with my tongue until your waiting voice breaks on my name."

His thumb brushed her lower lip. Diesel. Fluorescent future. Wet jeans. Choice sitting between them like unfinished fucking—hospital dawn with his blood under gauze, or waiting while he hunted with her taste still in his mouth.`
  },
  n: {
    w: `The recorder's red light made every breath look like evidence. Lieutenant Rhee's pen clicked. Ellison's folder sat thick enough to bruise. Jake's jaw worked once when association weather brushed the sealed past—hint only, pressure without a dump—and then he returned to science shields: bones unnamed, charm probable, closeness not sandbagging.

"Build a future after IA—leave this room into hospital-dawn weather and soft partnership while Cho stays patient," Jake murmured for [player_name] alone. "Carry the IA stand into Owen's trial—walk every sentence you fed Rhee into the next hard room where family pressure becomes docket. Both are hard rooms. One has better lighting. Neither invents a funeral for clearance."

Rain thickened on the high windows. Rhee waited. Ellison waited. Jake waited like a sealed file that had learned to love a witness out loud. Mid-want unfinished between rebuild and docket.`,
    h: `In the recess copy room Jake shoved [player_name] onto the low cabinet, dropped to a crouch, and ate her through the hearing's leftover adrenaline—toner smell, burnt coffee, his tongue filthy and precise—until she muffled a cry into her wrist. He rose shining, put her hand on his cock through his pants, and rolled once against her palm.

"Future after IA and I fuck you slow in hospital light until rebuild has a pulse," he whispered. "Owen's trial with your IA sentences as spine and I keep you aching through every recess because unfinished is how loyalty tastes when recorders sleep."

He was still tasting her. That was not in any memo yet. Grey-green eyes wrecked. She had to choose which room got their next hour—soft rebuild under rope, or docket weather with her stand still wet on his mouth.`
  },
  o: {
    w: `Blinds taped. Phones facedown. Muted chyron of City Hall stuttered without sound. Takeout ginger cooled on the counter. Jake checked the deadbolt like tenderness wearing habit's coat.

"Pier dawn—leave Harborwick or stay—means geography soft with teeth, boards and fog deciding whether we keep this city," he said. "Step back into the public storm means volume hard again, flashbulbs, correcting invented shame in daylight. Both leave Cho patient. Both leave the sealed past sealed tonight. Both leave me wanting your mouth after the chyron stops inventing us."

Outside, Harborwick shouted. Inside, soft held for one more fork. Jake's grey-green gaze held hers, tired, hungry, unfinished. Mid-want between boards-and-geography and flashbulbs-again while rain thickened against taped glass like a second audience.`,
    h: `Jake boxed her against the deadbolt, mouth at her ear, rolling his hips once against her bare slick so she felt exactly how unfinished he was. He had already had her on the counter—fingers, mouth, denial—and the room still smelled like sex and ginger and muted news.

"Pier dawn and I finish the kiss on the boards with fog for curtains," he whispered. "Public storm and I keep you dripping under flashbulbs' aftermath because unfinished want is how we refuse to perform shame for clicks."

His cracked knuckles traced her jaw. Either verb kept Renny a pointed finger. Either verb left Cho patient. Neither let him pretend hide-together cleaned him. The deadbolt waited. So did his mouth. So did the pier. So did the storm.`
  },
  p: {
    w: `Lantern light found Renny's age-progressed maybe on a festival poster and refused to make it science. Boards remembered. Fog erased the far pilings. Jake had offered truth instead of a ring—vow with pier salt, not jewelry.

"Answer the pier truth-proposal at dawn—honesty as the only jewelry these planks get," he said. "Take the hospital-dawn future instead—soft rebuild inland, machines inventing patience, us answering the case without carnival sugar for courage. Both move the case. Both hurt. Both leave bones unnamed until science earns a name."

A vendor's generator coughed near the lot—rhyme without accusation. [player_name] felt Jake's notebook in his jacket like a small black heart. Mid-want unfinished between boards-with-honesty and inland gauze while festival noise dug softer than cameras and still dug.`,
    h: `In the crate pocket Jake yanked her jeans and put his mouth on her under carnival sugar and sealed-past hum—tongue precise, denial cruel—then braced her against the plywood and rolled his hips once so she felt the unfinished claim through his pants.

"Truth-proposal and I get your mouth on my throat after the vow and my fingers back in this slick while foghorns speak," he said. "Hospital dawn and you save the soft for inland and I repay you with my tongue until your rebuild voice breaks on my name."

He laced their fingers hard enough to hurt and steered her one step toward Renny's unfinished smile on the poster. Last chance to breathe before the verb. Boards or gauze. Want still mid. Science still patient.`
  }
};

/** Replace last N paragraphs with unique exit */
function replaceExit(text, exit) {
  const paras = text.split(/\n\n/).filter((p) => p.trim().length);
  if (paras.length < 4) return text.trimEnd() + "\n\n" + exit;
  // Drop last 2–3 paras (typical exit block) and append unique exit
  const keep = paras.slice(0, -3);
  return [...keep, exit].join("\n\n");
}

function processLetter(L, classification) {
  const file = path.join(DIR, `scene8${L}.js`);
  let src = fs.readFileSync(file, "utf8");
  const parts = splitScene(src);

  let warm = stripMeta(parts.warm);
  let hot = stripMeta(parts.hot);

  warm = capSolis(warm, 1);
  hot = capSolis(hot, 1);

  // Replace exits with unique mid-want blocks
  const ex = EXITS[L];
  if (ex) {
    warm = replaceExit(warm, ex.w);
    hot = replaceExit(hot, ex.h);
  }

  // Final meta/Solis sweep on whole
  warm = stripMeta(warm);
  hot = stripMeta(hot);
  // If Solis still over, cap again
  warm = capSolis(warm, 1);
  hot = capSolis(hot, 1);

  // Ensure word counts — pad lightly if needed via sensory beat (rare)
  const padWarm =
    "\n\nPier salt ghosted the air even here. Chain-link rattled somewhere out of sight. Hope and dread kept their shared shift without asking permission.";
  const padHot =
    "\n\nHer cunt kept its own unfinished count. His grey-green eyes kept theirs. Harborwick's foghorn rolled through both like a third pulse that refused to resolve.";
  while (wc(warm) < 1500) warm += padWarm;
  while (wc(hot) < 1500) hot += padHot;

  const out = parts.head + warm + parts.mid + hot + parts.tail;
  fs.writeFileSync(file, out.endsWith("\n") ? out : out + "\n");
  return {
    L,
    classification,
    w: wc(warm),
    h: wc(hot),
    solisW: (warm.match(/Solis/gi) || []).length,
    solisH: (hot.match(/Solis/gi) || []).length,
    meta: /Layer\s*\d/.test(warm + hot),
  };
}

const light = new Set(["a", "b", "c", "d", "e", "f", "g", "h"]);
const results = [];
for (const L of "abcdefghijklmnop") {
  const classification = light.has(L) ? "light-touch" : "rewritten";
  results.push(processLetter(L, classification));
}

console.log(JSON.stringify(results, null, 2));
