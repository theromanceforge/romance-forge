# Until the Quiet Breaks — Premise (locked)

**Title:** *Until the Quiet Breaks*  
**Audience:** Wine-and-smut / spicy romance (BookTok-mom energy) — adult, not YA soft.  
**Themes:** Romance, family secrets, redemption.  
**Structure:** 10 layers, two-choice branching; Warm + Hot spice on every scene. See `TREE.md`.

---

## Who this story is

A woman comes home to a rain-wet town that still will not say her name the same way twice. Fifteen years ago she left Somerton to protect the boy she almost loved. Now his uncle’s letter has cracked the quiet open, and the truth she carried alone is no longer hers to bury. The romance is unfinished heat with **John Shaw**. The plot is whether trust can survive the secret that made her leave.

Use this page to brief the landing “who we are” and to keep every scene, illustration, and UI blurb on-voice.

---

## Locked cast & pronouns

| Name | Role |
|------|------|
| **[player_name]** | Female protagonist only (`she/her`). Addressed as `[player_name]` in prose. |
| **John Shaw** / **John** | Male love interest **only** (v1). Prefer “John” in dialogue/narrative; “John Shaw” for full name/family context. No second LI. Runs the Market Street diner. Henry’s nephew; brother of Clara Shaw. |
| **Henry Shaw** | Uncle; Willow Lane; author of the letter; keeper of half-truths who is running out of silence. |
| **Clara Shaw** | John’s younger sister; charcoal sketches, restless honesty; the one who found the papers. |
| *(offstage)* **John & Clara’s late father** | The wound the silence was built around. |
| *(fading)* **Their mother** | Left the story early; John raised Clara beside the diner lights. |

---

## Setting — Somerton

Late-autumn Somerton: rain on **slate roofs**, station platform hiss, freight that never quite leaves the yard. **Market Street** holds the diner with the **blue door that sticks**, coffee steam, fryer hymn, and the **cracked counter stool** that leans a half-degree left. **Willow Lane** holds the Shaw house: wet **boxwood**, **woodsmoke**, a mantel clock, and papers under a glass weight that look like someone tried to tidy guilt into innocence.

Sensory anchors (carry across branches):

- Rain on slate / station platform hiss  
- Blue diner door that sticks  
- Coffee steam / cracked counter stool  
- Wet boxwood and woodsmoke on Willow Lane  
- Clara’s charcoal sketches in margins of old schoolbooks / found papers  

---

## Hook

[player_name] left Somerton at twenty after a night the town still will not name aloud. She and John were almost something. She left anyway—believing silence would protect him.

**Henry’s letter** arrives in late autumn: not *come home*, only *I thought you should know*. Papers have surfaced. The quiet that kept Somerton intact is cracking. She buys the ticket.

---

## Central secret

Fifteen years ago, after a **winter accident** involving John’s father, Henry arranged a cover story that cast [player_name] as someone who left for a “bigger life”—when the truth was a **debt** (creditor thread later named **Voss** in Layer 5), a **failed promise**, and Henry’s choice to spare John the uglier facts. Clara has found enough paperwork (and drawn over it) to ask questions Henry can no longer dodge. John has lived with a version of that night that never quite fit.

Secrets plant early (Layers 1–4) and pay off through Layers 8–10. Endings differ by *how much truth is spoken*, *whether tenderness survives it*, and *who gets to narrate the Shaw name afterward*.

---

## Romantic axis

John stayed. He rebuilt the diner, raised Clara, and never stopped listening for a train that might bring her back. Attraction is immediate and unfinished; **trust is the real plot**. Every playthrough is adult desire with John—Warm or Hot—never a second love interest.

Branching intent (early layers):

- **scene2a (diner):** Lead with John and the body of the romance.  
- **scene2b (Willow):** Lead with Henry and the letter’s pressure.  
- Layers 3–4 split on *how much truth before tenderness*, *who confronts Henry*, and *whether Clara’s evidence opens now*.  
- Layers 5–7 deepen investigation, intimacy, and fracture lines (creditor ghosts, town gossip, Clara’s loyalty, Henry’s confession).  
- Layers 8–9 force irreversible choices (protect / expose / forgive / leave again).  
- Layer 10: distinct endings (`choices: []`).

---

## Spice meter (locked)

Every playthrough starts **Warm** or **Hot**. Choice **IDs stay identical** across spice—only prose (and optional choice-label heat) changes. The TREE does not fork by spice.

| Level | What it means |
|-------|----------------|
| **Warm** (`text`) | Yearning, tension, sensory intimacy, fade-friendly; still clearly adult. Default. |
| **Hot** (`textHot`) | Explicit desire, bodies, smut-forward beats; still character-driven—not porn-without-plot. |

Scene module shape:

```js
export default {
  id: "scene1",
  layer: 1,
  title: "Somerton Station",
  text: `...Warm...[player_name]...`,
  textHot: `...Hot...[player_name]...`,
  choices: [
    { id: "scene2a", text: "Warm label", textHot: "Hotter label" },
    { id: "scene2b", text: "Warm label", textHot: "Hotter label" }
  ]
};
```

Layer 10 endings: `choices: []` (both `text` and `textHot` still required).

Word floors (prose in each spice field): Layer 1 ~550; Layers 2–10 >1500 unless a scene is marked otherwise in TREE.

---

## Writing rules (story voice)

- Sensory setting → emotion → plot turn.  
- Choices must differ in stance, loyalty, or risk—not synonyms.  
- Literary branching romance, not marketing copy.  
- Recurring anchors listed above.  
- Endings are distinct destinations, not the same paragraph with a swapped last line.

---

## Craft bar (can’t-close-the-tab)

J Lamb’s standard: so captivating you can’t close the tab.

1. Every scene ends on a **hook** — unfinished kiss, half-spoken truth, knock, paper face-up — never a soft land before a choice.
2. Choice labels = **verbs of consequence** (risk / loyalty / desire), not polite summaries.
3. **Hot** = body-POV rewrite; one physical through-line per scene; heat advances plot — not Warm with desire garnish.
4. Rotate sensory anchors; cut elegant-absolute stacks; sharper dialogue with subtext.
5. Layer exits (and temporary stops) should **hurt to leave** — unanswered question + bodily want.

Bias obsession-grade tension over pretty description.
6. **Language:** vulgar words allowed when earned. Warm = adult yearning (blunt OK, not porn-diction by default). Hot = explicit body words (cock, cunt, fuck, etc.) fine when heat/character earn them — in-character, advances intimacy/power; not shock-for-shock or euphemism stacks.

## Build status (2026-09-09)

- Layers 1–4 scene files exist under `scenes/` (Warm prose in place; Hot backfill in progress / complete per layer).  
- Layer 4 is **no longer** a terminal band—TREE now continues through Layer 10. Existing `choices: []` on 4a–4h must be updated to two outbound IDs once Layer 5 IDs are locked in TREE.  
- Full map: `TREE.md`. Project rules: `/workspace/romance-forge/artifacts/FOUNDATION.md`.
