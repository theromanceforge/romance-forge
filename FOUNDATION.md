# Romance Forge — Grok Foundation

Restarted 2026-09-09 after leaving Replit / LoveLore.

This project builds interactive branching romance stories. The player is addressed as `[player_name]` with dynamic he/him or she/her pronouns. Core themes: romance, family secrets, redemption.

## What we are dropping

- Replit upload / extract.js / `tsx server/import-story.ts export`
- JSON artifact bundles meant only for Repl file explorer
- Paying Replit to host a story we can author and version here

## What we are keeping

- 9-layer tree, 75 scenes
- Scene IDs and two-choice branching
- JS module format so a later player/runtime can ingest the same files
- Word-count floors that made the old stories feel like novels, not vignettes

## Scene tree

| Layer | Count | IDs | Words | Choices |
|---|---:|---|---|---|
| 1 | 1 | scene1 | ~550 | 2 → 2a, 2b |
| 2 | 2 | scene2a–2b | >1500 | 2 each |
| 3 | 4 | scene3a–3d | >1500 | 2 each |
| 4 | 8 | scene4a–4h | >1500 | 2 each |
| 5 | 16 | scene5a–5p | >1500 | 2 each |
| 6 | 16 | scene6a–6p | >1500 | 2 each |
| 7 | 16 | scene7a–7p | >1500 | 2 each |
| 8 | 8 | scene8a–8h | >1500 | 2 each |
| 9 | 10 | scene9a–9j | >1500 | none (endings) |

**Total: 75 scenes.**

Lettering is sequential a–p (16 letters) for layers 5–7. The old template mixed `scene6aj` / `scene7r`; we will not. Every non-ending scene has exactly two outbound IDs that land on the next layer.

## File format

One file per scene:

```js
export default {
  id: "scene1",
  layer: 1,
  text: `...narrative with [player_name]...`,
  choices: [
    { id: "scene2a", text: "Choice A." },
    { id: "scene2b", text: "Choice B." }
  ]
};
```

Layer 9: `choices: []`.

Folder layout (once writing starts):

```text
artifacts/
  FOUNDATION.md          ← this file
  stories/
    <slug>/
      PREMISE.md
      TREE.md            ← choice map
      scenes/
        scene1.js
        ...
```

## Writing rules

- Sensory setting first; emotion second; plot turn third.
- Choices must be meaningfully different (stance, loyalty, risk), not synonyms.
- Recurring sensory anchors (a scent, a sound, an object) carry across branches.
- Secrets should be planted early and paid off in Layer 8–9.
- Endings should be distinct destinations, not the same paragraph with a different last sentence.

## Suggested build order

1. Lock premise (setting, hook, 4–6 named characters, central secret, romantic axis).
2. Write TREE.md (all 75 IDs and choice labels) before prose.
3. Draft Layer 1 + Layer 2 (3 scenes) and review voice.
4. Then Layer 3–4, then the three 16-scene bands, then endings.
5. Only after the tree is complete: optional player/runtime.

## Locked for story one (2026-09-09)

- Title: *Until the Quiet Breaks* rewrite
- Protagonist: female only (`she/her`)
- Romance: Jake Shaw (male only). No second LI in v1.
- Landing page: `artifacts/index.html`
- Premise: `artifacts/stories/until-the-quiet-breaks/PREMISE.md`
- Scene 1: `artifacts/stories/until-the-quiet-breaks/scenes/scene1.js`

Next: Layer 2 (`scene2a` diner / `scene2b` Willow) when asked.
