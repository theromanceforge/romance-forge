# The Soft Alibi — Layers 2–9 rewrite plan

_Generated 2026-09-24 after `scripts/strip-soft-alibi-padding.mjs` removed the repeated stock padding and planning/meta sentences. Nothing here has been rewritten yet._

## Why

Layers 2b–9 had reached the ">1500 words" floor by repeating six stock paragraphs (up to ~40 times per scene) and were full of spec language leaking into reader text ("Layer 7…", "choice labels", "intimacy-forward, never gore", "romance locked on Nolan Greer alone"…). After stripping, L2–L9 went from **262,000 → 49,511 words**. Every scene below needs real prose to reach the floor again.

## Targets & rules (from PREMISE.md / house style)

- **Length:** Warm (`text`) and Hot (`textHot`) each **1500–1800 words** (PREMISE floor: Layers 2–9 >1500). Scene2a is already at length: polish only.
- **Keep:** scene IDs, titles, layer, choice IDs and tree structure. Choice labels may be tightened but must keep their target IDs.
- **Every scene ends mid-want** on its own closing beat (unfinished kiss, badge knock, calendar gap, cufflink click), leading into the two choices. The strip left several scenes ending on a fragment like "Black car." Those need a real closing beat.
- **Warm** = adult tension and yearning. **Hot** = a body-POV rewrite of the same beats, explicit, vulgar only when the scene earns it, heat advancing trust/complicity/power. Hot is not Warm plus garnish.
- **No planning language in prose:** no layers, choices/labels/"verbs", tree, endings-as-structure, POV/heat-level rules, "romance locked", "four fates stay open on purpose", "she/her" tags, anchor lists. The guard in `scripts/lib/soft-alibi-clean.mjs` (`findMeta`) rejects these, and the L5–L9 fatten scripts refuse to write parts that fail it or fall under 1500 words.
- **Voice to retire:** the jargon noun "mid-want" (still ~75 occurrences after the strip), "Soft alibi had become X", repeated "early thirties / mid-forties finance and tech holding" tags, and stacked anchor fragments ("Wine rings. Elevator chime. Black car.").
- **Continuity:** Vivienne's four fates stay contested through L9 (no settled truth); Brooks is missing-persons in L1–4 and homicide interest from L5 on; Nolan is the only love interest; zero cross-title names.
- **Workflow per batch:** write parts JSON (`scripts/soft-alibi-l{N}-parts/`; add L2–L4 parts dirs), run the layer's fatten script (it refuses on any failure), `npm test`, `npm run build`, then read the scene in the app on both spice levels.

## Batches (reading order: earlier layers first)

9 batches, 10 / 10 / 10 / 10 / 10 / 9 / 9 / 9 / 9 scenes. "Reach" = share of playthroughs that visit the scene if choices are picked uniformly from scene1. It's a rough proxy for how often each scene is played.

### Batch 1: scene2a–scene4d (10 scenes)

| Scene | Title | Layer | Reach | Warm now | Hot now | Target W / H | Notes |
|---|---|---:|---:|---:|---:|---|---|
| scene2a | Across the Hall / Private Elevator | 2 | 50.0% | 1602 | 1466 | keep ~1500–1650 / 1500–1650 | never padded; light polish only |
| scene2b | Rhea's Desk / Concierge Slate | 2 | 50.0% | 951 | 773 | 1500–1800 / 1500–1800 |  |
| scene3a | Protect Nolan | 3 | 25.0% | 880 | 649 | 1500–1800 / 1500–1800 |  |
| scene3b | Weekly to Monthly to Gone | 3 | 25.0% | 757 | 508 | 1500–1800 / 1500–1800 |  |
| scene3c | Walk Rhea's Log Toward Brooks | 3 | 25.0% | 689 | 438 | 1500–1800 / 1500–1800 | Hot closing beat was meta (now ends on prior line) |
| scene3d | Stall the Slate | 3 | 25.0% | 550 | 409 | 1500–1800 / 1500–1800 |  |
| scene4a | Soft-Alibi Heat | 4 | 12.5% | 528 | 324 | 1500–1800 / 1500–1800 |  |
| scene4b | Lawyer the Night | 4 | 12.5% | 470 | 287 | 1500–1800 / 1500–1800 |  |
| scene4c | Unfinished Hallway Kiss | 4 | 12.5% | 406 | 272 | 1500–1800 / 1500–1800 | Warm closing beat was meta (now ends on prior line) |
| scene4d | Unredacted Travel Story | 4 | 12.5% | 399 | 237 | 1500–1800 / 1500–1800 |  |

### Batch 2: scene4e–scene5f (10 scenes)

| Scene | Title | Layer | Reach | Warm now | Hot now | Target W / H | Notes |
|---|---|---:|---:|---:|---:|---|---|
| scene4e | Calendar Confessed | 4 | 12.5% | 427 | 254 | 1500–1800 / 1500–1800 |  |
| scene4f | Guest-Log Tip | 4 | 12.5% | 321 | 184 | 1500–1800 / 1500–1800 | Warm closing beat was meta (now ends on prior line) |
| scene4g | Black-Car Nights | 4 | 12.5% | 263 | 166 | 1500–1800 / 1500–1800 |  |
| scene4h | The Neighbor Door | 4 | 12.5% | 261 | 174 | 1500–1800 / 1500–1800 |  |
| scene5a | Cooperate Fully | 5 | 6.3% | 737 | 532 | 1500–1800 / 1500–1800 |  |
| scene5b | Off-Record Honesty | 5 | 6.3% | 681 | 501 | 1500–1800 / 1500–1800 |  |
| scene5c | Controlled Drip | 5 | 6.3% | 619 | 418 | 1500–1800 / 1500–1800 |  |
| scene5d | Raw Admission | 5 | 6.3% | 532 | 410 | 1500–1800 / 1500–1800 |  |
| scene5e | Unfinished Hallway Kiss | 5 | 6.3% | 641 | 427 | 1500–1800 / 1500–1800 |  |
| scene5f | Travel File Call | 5 | 6.3% | 631 | 399 | 1500–1800 / 1500–1800 |  |

### Batch 3: scene5g–scene5p (10 scenes)

| Scene | Title | Layer | Reach | Warm now | Hot now | Target W / H | Notes |
|---|---|---:|---:|---:|---:|---|---|
| scene5g | Partial Calendar Truth | 5 | 6.3% | 521 | 314 | 1500–1800 / 1500–1800 | Warm closing beat was meta (now ends on prior line); Hot closing beat was meta (now ends on prior line) |
| scene5h | Soft Interview | 5 | 6.3% | 526 | 312 | 1500–1800 / 1500–1800 |  |
| scene5i | Rhea Under Watch | 5 | 6.3% | 407 | 183 | 1500–1800 / 1500–1800 |  |
| scene5j | Burned Guest Log | 5 | 6.3% | 376 | 147 | 1500–1800 / 1500–1800 | Hot closing beat was meta (now ends on prior line) |
| scene5k | Guilt Spiral | 5 | 6.3% | 345 | 161 | 1500–1800 / 1500–1800 | Warm closing beat was meta (now ends on prior line) |
| scene5l | Sandbagging | 5 | 6.3% | 310 | 108 | 1500–1800 / 1500–1800 | Hot closing beat was meta (now ends on prior line) |
| scene5m | Private Hangar | 5 | 6.3% | 308 | 138 | 1500–1800 / 1500–1800 | Hot closing beat was meta (now ends on prior line) |
| scene5n | Holding Badge | 5 | 6.3% | 280 | 134 | 1500–1800 / 1500–1800 | Warm closing beat was meta (now ends on prior line); Hot closing beat was meta (now ends on prior line) |
| scene5o | Soft Shield | 5 | 6.3% | 310 | 123 | 1500–1800 / 1500–1800 |  |
| scene5p | Lobby Circle | 5 | 6.3% | 256 | 156 | 1500–1800 / 1500–1800 | Warm closing beat was meta (now ends on prior line); Hot closing beat was meta (now ends on prior line) |

### Batch 4: scene6a–scene6j (10 scenes)

| Scene | Title | Layer | Reach | Warm now | Hot now | Target W / H | Notes |
|---|---|---:|---:|---:|---:|---|---|
| scene6a | Locked Drawer | 6 | 6.3% | 535 | 363 | 1500–1800 / 1500–1800 | Hot closing beat was meta (now ends on prior line) |
| scene6b | Unnamed Night | 6 | 6.3% | 422 | 282 | 1500–1800 / 1500–1800 | Warm closing beat was meta (now ends on prior line) |
| scene6c | Marble Printouts | 6 | 6.3% | 352 | 194 | 1500–1800 / 1500–1800 |  |
| scene6d | Silence War | 6 | 6.3% | 238 | 174 | 1500–1800 / 1500–1800 | Warm closing beat was meta (now ends on prior line) |
| scene6e | Pell Smells Sandbagging | 6 | 6.3% | 425 | 156 | 1500–1800 / 1500–1800 | Hot closing beat was meta (now ends on prior line) |
| scene6f | Point of No Return | 6 | 6.3% | 337 | 163 | 1500–1800 / 1500–1800 | Hot closing beat was meta (now ends on prior line) |
| scene6g | Hangar Before Dawn | 6 | 6.3% | 327 | 145 | 1500–1800 / 1500–1800 | Hot closing beat was meta (now ends on prior line) |
| scene6h | Perfume Twin | 6 | 6.3% | 286 | 123 | 1500–1800 / 1500–1800 | Hot closing beat was meta (now ends on prior line) |
| scene6i | Soft Interview Door | 6 | 6.3% | 302 | 102 | 1500–1800 / 1500–1800 | Hot closing beat was meta (now ends on prior line) |
| scene6j | Brooks Blowup | 6 | 6.3% | 216 | 87 | 1500–1800 / 1500–1800 | Warm closing beat was meta (now ends on prior line); Hot closing beat was meta (now ends on prior line) |

### Batch 5: scene6k–scene7d (10 scenes)

| Scene | Title | Layer | Reach | Warm now | Hot now | Target W / H | Notes |
|---|---|---:|---:|---:|---:|---|---|
| scene6k | Burned Log Ash | 6 | 6.3% | 236 | 56 | 1500–1800 / 1500–1800 | Hot only 56w after strip; Hot closing beat was meta (now ends on prior line) |
| scene6l | Obstruction Fight | 6 | 6.3% | 259 | 79 | 1500–1800 / 1500–1800 | Hot only 79w after strip; Hot closing beat was meta (now ends on prior line) |
| scene6m | Raid Planning | 6 | 6.3% | 215 | 97 | 1500–1800 / 1500–1800 | Hot closing beat was meta (now ends on prior line); choice 1 retargeted 7n→7m ("Hold the soft story through the raid"); Hot prose still offers "inquiry closeness" — align |
| scene6n | Holding Badge Number | 6 | 6.3% | 208 | 62 | 1500–1800 / 1500–1800 | Warm closing beat was meta (now ends on prior line); Hot only 62w after strip; Hot closing beat was meta (now ends on prior line) |
| scene6o | Shield Nolan | 6 | 6.3% | 209 | 105 | 1500–1800 / 1500–1800 | Warm closing beat was meta (now ends on prior line); Hot closing beat was meta (now ends on prior line) |
| scene6p | She Walks | 6 | 6.3% | 213 | 111 | 1500–1800 / 1500–1800 | Warm closing beat was meta (now ends on prior line); Hot closing beat was meta (now ends on prior line) |
| scene7a | Silent-Partner File | 7 | 12.5% | 383 | 346 | 1500–1800 / 1500–1800 | Hot closing beat was meta (now ends on prior line) |
| scene7b | The Gap in Her Story | 7 | 9.4% | 327 | 224 | 1500–1800 / 1500–1800 | Hot closing beat was meta (now ends on prior line) |
| scene7c | Second Address | 7 | 9.4% | 305 | 117 | 1500–1800 / 1500–1800 | Hot closing beat was meta (now ends on prior line) |
| scene7d | Want Returns | 7 | 6.3% | 244 | 77 | 1500–1800 / 1500–1800 | Hot only 77w after strip; Hot closing beat was meta (now ends on prior line) |

### Batch 6: scene7e–scene7m (9 scenes)

| Scene | Title | Layer | Reach | Warm now | Hot now | Target W / H | Notes |
|---|---|---:|---:|---:|---:|---|---|
| scene7e | Brooks Ultimatum | 7 | 9.4% | 270 | 83 | 1500–1800 / 1500–1800 | Warm closing beat was meta (now ends on prior line); Hot closing beat was meta (now ends on prior line) |
| scene7f | Leaked Recording | 7 | 9.4% | 228 | 82 | 1500–1800 / 1500–1800 | Hot closing beat was meta (now ends on prior line) |
| scene7g | Hangar Breach | 7 | 9.4% | 215 | 91 | 1500–1800 / 1500–1800 | Hot closing beat was meta (now ends on prior line) |
| scene7h | Last Hour Reconstructed | 7 | 6.3% | 228 | 67 | 1500–1800 / 1500–1800 | Hot only 67w after strip; Hot closing beat was meta (now ends on prior line) |
| scene7i | Across the Hall | 7 | 3.1% | 227 | 75 | 1500–1800 / 1500–1800 | Hot only 75w after strip; Hot closing beat was meta (now ends on prior line) |
| scene7j | Pell's Listening Wire | 7 | 3.1% | 182 | 83 | 1500–1800 / 1500–1800 | Hot closing beat was meta (now ends on prior line) |
| scene7k | Plane-Desk Messages | 7 | 3.1% | 189 | 66 | 1500–1800 / 1500–1800 | Hot only 66w after strip; Hot closing beat was meta (now ends on prior line) |
| scene7l | Break Open | 7 | 3.1% | 211 | 56 | 1500–1800 / 1500–1800 | Hot only 56w after strip; Hot closing beat was meta (now ends on prior line) |
| scene7m | Raid Consequence | 7 | 3.1% | 192 | 70 | 1500–1800 / 1500–1800 | Hot only 70w after strip; Hot closing beat was meta (now ends on prior line) |

### Batch 7: scene7n–scene8f (9 scenes)

| Scene | Title | Layer | Reach | Warm now | Hot now | Target W / H | Notes |
|---|---|---:|---:|---:|---:|---|---|
| scene7n | Inquiry | 7 | 3.1% | 193 | 71 | 1500–1800 / 1500–1800 | Hot only 71w after strip; Hot closing beat was meta (now ends on prior line) |
| scene7o | Public Enough | 7 | 3.1% | 183 | 76 | 1500–1800 / 1500–1800 | Hot only 76w after strip; Hot closing beat was meta (now ends on prior line) |
| scene7p | Elevator-Bank Reunion | 7 | 6.3% | 183 | 92 | 1500–1800 / 1500–1800 | Hot closing beat was meta (now ends on prior line) |
| scene8a | Name the Absence Method | 8 | 10.9% | 363 | 288 | 1500–1800 / 1500–1800 |  |
| scene8b | Bargain with Pell | 8 | 7.8% | 261 | 209 | 1500–1800 / 1500–1800 |  |
| scene8c | Night Truth | 8 | 10.9% | 306 | 233 | 1500–1800 / 1500–1800 |  |
| scene8d | Night Truth Burned | 8 | 9.4% | 257 | 170 | 1500–1800 / 1500–1800 |  |
| scene8e | Widen the Search Map | 8 | 6.3% | 251 | 165 | 1500–1800 / 1500–1800 |  |
| scene8f | Keep Crownspire Only | 8 | 9.4% | 216 | 127 | 1500–1800 / 1500–1800 |  |

### Batch 8: scene8g–scene8o (9 scenes)

| Scene | Title | Layer | Reach | Warm now | Hot now | Target W / H | Notes |
|---|---|---:|---:|---:|---:|---|---|
| scene8g | Catch the Handler | 8 | 7.8% | 258 | 179 | 1500–1800 / 1500–1800 |  |
| scene8h | Pell Confesses | 8 | 4.7% | 239 | 167 | 1500–1800 / 1500–1800 |  |
| scene8i | Holding-Chain Wire | 8 | 7.8% | 230 | 160 | 1500–1800 / 1500–1800 |  |
| scene8j | Made | 8 | 6.3% | 233 | 146 | 1500–1800 / 1500–1800 |  |
| scene8k | Board / Press Broadcast | 8 | 4.7% | 240 | 150 | 1500–1800 / 1500–1800 |  |
| scene8l | Quiet Deal | 8 | 4.7% | 219 | 140 | 1500–1800 / 1500–1800 |  |
| scene8m | Raid Aftermath | 8 | 3.1% | 249 | 158 | 1500–1800 / 1500–1800 |  |
| scene8n | Inquiry Hearing | 8 | 3.1% | 208 | 162 | 1500–1800 / 1500–1800 |  |
| scene8o | Public Storm | 8 | 3.1% | 246 | 183 | 1500–1800 / 1500–1800 |  |

### Batch 9: scene8p–scene9h (9 scenes)

| Scene | Title | Layer | Reach | Warm now | Hot now | Target W / H | Notes |
|---|---|---:|---:|---:|---:|---|---|
| scene8p | Glass Anniversary | 8 | 0.0% | 245 | 217 | 1500–1800 / 1500–1800 | Hot closing beat was meta (now ends on prior line); UNREACHABLE (no parent choice) — needs a parent before rewrite matters |
| scene9a | Stand as Cover | 9 | 18.8% | 299 | 237 | 1500–1800 / 1500–1800 |  |
| scene9b | Mercy Rewrite | 9 | 16.4% | 269 | 175 | 1500–1800 / 1500–1800 |  |
| scene9c | Open Crownspire | 9 | 18.8% | 240 | 181 | 1500–1800 / 1500–1800 |  |
| scene9d | Pell's Quiet Deal | 9 | 10.2% | 263 | 181 | 1500–1800 / 1500–1800 |  |
| scene9e | One Fate Thread | 9 | 14.1% | 235 | 172 | 1500–1800 / 1500–1800 |  |
| scene9f | Handler Escapes | 9 | 7.0% | 264 | 177 | 1500–1800 / 1500–1800 |  |
| scene9g | Hospital / Lobby Dawn | 9 | 9.4% | 251 | 163 | 1500–1800 / 1500–1800 |  |
| scene9h | Glass Dawn | 9 | 5.5% | 261 | 165 | 1500–1800 / 1500–1800 |  |

## Shortest after strip (<150 words in either version): 32 scenes

scene5j (W 376 / H 147), scene5l (W 310 / H 108), scene5m (W 308 / H 138), scene5n (W 280 / H 134), scene5o (W 310 / H 123), scene6g (W 327 / H 145), scene6h (W 286 / H 123), scene6i (W 302 / H 102), scene6j (W 216 / H 87), scene6k (W 236 / H 56), scene6l (W 259 / H 79), scene6m (W 215 / H 97), scene6n (W 208 / H 62), scene6o (W 209 / H 105), scene6p (W 213 / H 111), scene7c (W 305 / H 117), scene7d (W 244 / H 77), scene7e (W 270 / H 83), scene7f (W 228 / H 82), scene7g (W 215 / H 91), scene7h (W 228 / H 67), scene7i (W 227 / H 75), scene7j (W 182 / H 83), scene7k (W 189 / H 66), scene7l (W 211 / H 56), scene7m (W 192 / H 70), scene7n (W 193 / H 71), scene7o (W 183 / H 76), scene7p (W 183 / H 92), scene8f (W 216 / H 127), scene8j (W 233 / H 146), scene8l (W 219 / H 140)

## Open structural items (not part of the rewrite itself)

- **scene8p (Glass Anniversary)** has no parent choice. Candidates: scene7p (elevator-bank reunion) or scene7l (break-open). Neither is clearly specified in TREE.md.
- **scene10d (Stay Cold)** has no parent choice. Candidate: scene9h (glass dawn: leave or stay), which currently offers 10c/10j. Adding 10d there would replace one of them.
- **scene6m** was retargeted to scene7m during the strip commit, so its Hot prose should be aligned in Batch 5.
