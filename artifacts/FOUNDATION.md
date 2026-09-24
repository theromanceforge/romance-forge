# Romance Forge — Grok Foundation

Restarted 2026-09-09 after leaving Replit / LoveLore.

This project builds interactive branching romance stories. Core themes: romance, family secrets, redemption. Audience: wine-and-smut / spicy romance (BookTok-mom) — adult, not YA.

Story one (*Until the Quiet Breaks*) locks a **female** protagonist (`she/her`) addressed as `[player_name]`, with **Jake Shaw** as the only male LI.

## What we are dropping

- Replit upload / extract.js / `tsx server/import-story.ts export`
- JSON artifact bundles meant only for Repl file explorer
- Paying Replit to host a story we can author and version here

## What we are keeping

- Deep branching tree with scene IDs and two-choice branches
- JS module format so a player/runtime can ingest the same files
- Word-count floors that feel like a novel, not vignettes
- Warm + Hot spice fields on every scene

## Scene tree (10 layers — locked 2026-09-09)

| Layer | Count | IDs | Words | Choices |
|---|---:|---|---|---|
| 1 | 1 | scene1 | ~550 | 2 → 2a, 2b |
| 2 | 2 | scene2a–2b | >1500 | 2 each |
| 3 | 4 | scene3a–3d | >1500 | 2 each |
| 4 | 8 | scene4a–4h | >1500 | 2 each |
| 5 | 16 | scene5a–5p | >1500 | 2 each |
| 6 | 16 | scene6a–6p | >1500 | 2 each |
| 7 | 16 | scene7a–7p | >1500 | 2 each |
| 8 | 16 | scene8a–8p | >1500 | 2 each |
| 9 | 8 | scene9a–9h | >1500 | 2 each |
| 10 | 10 | scene10a–10j | >1500 | none (endings) |

**Total: 97 scenes.**

Lettering is sequential `a–p` (16 letters) for 16-scene layers; `a–h` for 8-scene layers; `a–j` for endings. No weird IDs. Every non-ending scene has exactly two outbound IDs. Mid layers may **converge** (multiple parents → same child).

## Spice meter

| Level | Field | Tone |
|-------|-------|------|
| Warm (default) | `text` | Yearning, tension, sensory intimacy, fade-friendly; still adult |
| Hot | `textHot` | Explicit desire, bodies, smut-forward; character-driven |

Choice **IDs are identical** across spice. Optional `textHot` on choice labels for hotter button copy.

## File format

```js
export default {
  id: "scene1",
  layer: 1,
  title: "Somerton Station",
  text: `...Warm narrative with [player_name]...`,
  textHot: `...Hot narrative with [player_name]...`,
  choices: [
    { id: "scene2a", text: "Warm label.", textHot: "Hotter label." },
    { id: "scene2b", text: "Warm label.", textHot: "Hotter label." }
  ]
};
```

Layer 10: `choices: []` (both `text` and `textHot` still required).

Folder layout:

```text
artifacts/
  FOUNDATION.md
  stories/
    <slug>/
      PREMISE.md
      TREE.md
      scenes/
        scene1.js
        ...
```

## Writing rules

- Sensory setting first; emotion second; plot turn third.
- Choices must be meaningfully different (stance, loyalty, risk), not synonyms.
- Recurring sensory anchors carry across branches.
- Secrets plant early and pay off in Layers 8–10.
- Endings are distinct destinations, not the same paragraph with a different last sentence.

## Suggested build order

1. Lock premise (setting, hook, cast, central secret, romantic axis, spice rules).
2. Write TREE.md (all 97 IDs and choice labels) before mid/late prose.
3. Draft Layers 1–2, review voice; then 3–4; then 5+ bands; then endings.
4. Keep Warm + Hot in parallel once spice is locked.
5. Player/runtime can wire incrementally as layers land.

## Locked for story one (2026-09-09)

- Title: *Until the Quiet Breaks*
- Protagonist: female only (`she/her`)
- Romance: Jake Shaw (male only). No second LI in v1.
- Premise: `artifacts/stories/until-the-quiet-breaks/PREMISE.md`
- Tree: `artifacts/stories/until-the-quiet-breaks/TREE.md` (10 layers / 97 scenes)
- Scenes: `artifacts/stories/until-the-quiet-breaks/scenes/`
