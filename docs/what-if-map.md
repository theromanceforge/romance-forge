# What-if map (post-play)

## Purpose

After a reader reaches a Layer 10 ending, show **2–3 “roads not taken”** teaser cards. The goal is replay curiosity and shareable “what if I’d chosen differently?” moments — free, never paywalled, never spoiler-heavy.

## Where it appears

- **Must-have:** the ending screen (`ending-block`), below the closing line / review panel and above Restart.
- Compact landing teaser is optional later; this ship does not invent a post-finish landing state (Restart clears path).

## Card anatomy

Each card includes:

1. **Chapter label** — e.g. `Chapter 6`
2. **Tease** — lightly framed alternate choice label (`What if you had…` + choice text)
3. **Action** — **Replay from here** (preferred)

No unfinished prose, no ending body text, no ads inside the map.

## Selection rule (data-driven)

Derived from the reader’s recorded `path[]` (scene ids visited, including start):

1. For each path scene with two choices, the choice **not** taken (unused sibling) is a candidate.
2. Prefer **later / more pivotal** forks (higher layer first).
3. **One card per scene**, dedupe by choice id / label.
4. Cap at **2–3** cards.
5. Skip any label that would **reveal an ending title** (substring match against Layer 10 titles).
6. Optional per-story **authored override**: `CATALOG[].whatIf = [{ sceneId, choiceIndex|target, tease }]`. When present and valid, overrides win; otherwise derived cards are used. Future Survey story works automatically via the same path + scenes shape.

## Actions

**Replay from here** trims the save path to the fork scene, keeps **name + spice**, lands on that scene with the alternate choice **highlighted**. The reader can then take it.

## Spoiler guardrails

- Teasers use **choice-label vibe only** — never ending prose.
- Labels that contain an ending title are filtered out.
- Outline-ish / planning labels (e.g. `Full coop: …`) should be flagged for Forge Scribe rather than rewritten in app code. Prefer authored `whatIf` overrides when derived copy feels thin.

## Ads rule

- No ads over or inside the what-if UI.
- **Replay from here** skips between-scene interstitial logic (same as existing Replay last choice): it does **not** call `shouldShowInterstitial`, so mid-path ads cannot cover the cards or the jump.
- Existing never-interrupt rules for endings / auth / replay remain untouched; ad/analytics modules are not modified for this feature.

## Future authored-tease override

Writers (Forge Scribe) can supply `whatIf` on a catalog entry:

```js
whatIf: [
  { sceneId: "scene5a", target: "scene6b", tease: "What if you had protected him one more hour?" },
]
```

If omitted, selection stays fully derived from unused siblings.
