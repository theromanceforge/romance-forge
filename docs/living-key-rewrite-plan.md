# The Living Key — Layers 4–9 rewrite plan

_Generated 2026-09-24 after the mechanical cleanup (`node scripts/clean-story.mjs the-living-key --pad-layers 4-9 --sent-pad`) removed repeated stock padding and planning/meta sentences. Nothing here has been rewritten yet._

## Why

Layers 4–9 reached the old ">1500 words" floor by repeating rotating stock paragraphs and sentences ("Salt wind fretted Ashmere's stone again…", "Romance locked on Cassian Rook alone…", "Mid-want hummed unfinished beneath duty…") up to dozens of times per scene, and by the `fatten-living-key-*` scripts. All 97 scenes also leaked spec language ("Sex was not violence cosplay.", "Romance lock held.", "held the hinge", scene IDs, "Secrets planted early.", "Key never only."). After the cleanup, L4–L9 went from **255,288 → 103,437 words** (Warm + Hot). L1–L3 were never padded; they only lost meta sentences and need a light polish at most.

## Targets & rules

- **Length:** Warm (`text`) and Hot (`textHot`) each **~900–1,200 words**. Lean sentences: mostly short, concrete, one idea each. No stacked anchor fragments ("Salt. Ozone. Copper."), no 60-word catalog sentences.
- **Keep:** scene IDs, titles, layer, choice IDs and the tree. Choice labels may be tightened into short in-story actions but must keep their target IDs.
- **Every scene ends mid-want** on a concrete closing beat that leads into its two choices. Several scenes now end on a fragment (flagged below) and need a real last beat.
- **Warm** = adult tension and yearning. **Hot** = body-POV version of the same beats, explicit only where the scene earns it, and heat has to move trust or power forward. Hot is its own draft, not Warm with extra lines.
- **No planning language in prose or labels:** no layers/scene IDs, "choice", "verb", "hinge", "mid-want", POV/heat-level rules, "romance lock", gore/cosplay disclaimers, ending names, "hints only / not dumped", "key never only". `tests/story-quality.test.js` fails the build on these, and on any scene with >5% repeated paragraphs.
- **Voice to retire:** character-sheet echoes ("mid-thirties battlemage", "brutal charm", "scorched leather, practice-blade oil" in every scene), "Trust under apocalypse pressure", "living-key ambiguity still fog", "catalogued … location, intensity, ask", "stood between X and scorched leather", "Want held…".
- **Continuity:** Cassian Rook is the only love interest; the living-key truth stays contested until L9 pays it off; Thorne stays monster-or-revolutionary; Cassian's sealed past is revealed in pieces; zero cross-title names.
- **Workflow per batch:** write parts JSON into `scripts/living-key-l{N}-parts/<sceneId>.json` (L8i–p and L9 have guarded writers: `scripts/fatten-living-key-l8ip.mjs`, `scripts/fatten-living-key-l9.mjs`; add a writer per layer using `scripts/lib/guarded-scene-writer.mjs`). The writer refuses parts under 900 words, with repeated paragraphs, meta language, or truncated labels. Then `npx vitest run`, `npm run build`, and read the scene in the app at both spice levels.

## Batches (reading order: earlier layers first)

8 batches, 10 / 10 / 10 / 10 / 10 / 10 / 10 / 10 scenes. "Reach" = share of playthroughs that visit the scene if choices are picked uniformly from scene1 (rough proxy for how often each scene is played). "Before" = words before the cleanup (mostly padding).

### Batch 1: scene4a–scene5b (10 scenes)

| Scene | Title | Layer | Reach | Warm now | Hot now | Before W / H | Target W / H | Notes |
|---|---|---:|---:|---:|---:|---|---|---|
| scene4a | Oath heat — Isolde almost seals her as living key; Cassian interrupts | 4 | 12.5% | 1673 | 1544 | 1673 / 1572 | 900–1,200 / 900–1,200 | already over target: tighten, keep beats |
| scene4b | She lawyers the oath with Collegium counsel; Cassian’s trust cracks | 4 | 12.5% | 1541 | 1475 | 1595 / 1520 | 900–1,200 / 900–1,200 | already over target: tighten, keep beats |
| scene4c | Cliff spar — rain, almost-kiss, Thorne’s mark pulses under their feet | 4 | 12.5% | 738 | 290 | 1527 / 1545 | 900–1,200 / 900–1,200 | Hot much thinner than Warm |
| scene4d | Cliff spar — she refuses the romance; demands Bram’s unredacted hymn on *unidentified* living keys | 4 | 12.5% | 621 | 243 | 1598 / 1610 | 900–1,200 / 900–1,200 | under 250 real words; Hot much thinner than Warm |
| scene4e | Frequency confessed — Cassian moves to report Thorne contact; she begs for a softer net | 4 | 12.5% | 678 | 347 | 1558 / 1633 | 900–1,200 / 900–1,200 | Hot much thinner than Warm |
| scene4f | Frequency confessed — she tips Maris that Cassian will raid the lower wards | 4 | 12.5% | 641 | 258 | 1521 / 1544 | 900–1,200 / 900–1,200 | Hot much thinner than Warm |
| scene4g | Rumor path — Maris admits hearing Thorne’s voice in the Unmade whisper | 4 | 12.5% | 553 | 130 | 1530 / 1634 | 900–1,200 / 900–1,200 | under 250 real words; Hot much thinner than Warm |
| scene4h | Rumor path — Maris clams up; Cassian wants to lean on her harder | 4 | 12.5% | 554 | 230 | 1525 / 1634 | 900–1,200 / 900–1,200 | under 250 real words; Hot much thinner than Warm |
| scene5a | Isolde’s office: cooperate fully or lose Collegium access | 5 | 6.3% | 1585 | 1628 | 1695 / 1659 | 900–1,200 / 900–1,200 | already over target: tighten, keep beats |
| scene5b | Cassian’s quarters: off-record honesty after Isolde | 5 | 6.3% | 1085 | 983 | 1561 / 1528 | 900–1,200 / 900–1,200 | in range: polish only |

### Batch 2: scene5c–scene5l (10 scenes)

| Scene | Title | Layer | Reach | Warm now | Hot now | Before W / H | Target W / H | Notes |
|---|---|---:|---:|---:|---:|---|---|---|
| scene5c | Counsel present: controlled drip of the frequency truth | 5 | 6.3% | 509 | 285 | 1546 / 1537 | 900–1,200 / 900–1,200 | Hot much thinner than Warm |
| scene5d | No counsel: raw admission that her song matches Thorne’s | 5 | 6.3% | 632 | 323 | 1556 / 1599 | 900–1,200 / 900–1,200 | Hot much thinner than Warm |
| scene5e | Rain kiss unfinished — ward-tape between them on the cliff | 5 | 6.3% | 408 | 183 | 1583 / 1585 | 900–1,200 / 900–1,200 | under 250 real words; Hot much thinner than Warm |
| scene5f | Bram calls: hymn fragment says living keys can be *refused* — still not the full sacrifice map | 5 | 6.3% | 316 | 193 | 1620 / 1572 | 900–1,200 / 900–1,200 | under 250 real words; Hot ends on fragment ("Unmade pressing.") |
| scene5g | Partial hymn — she confronts Isolde alone while the Unmade still contested | 5 | 6.3% | 296 | 181 | 1569 / 1559 | 900–1,200 / 900–1,200 | under 250 real words |
| scene5h | Partial hymn — she brings Cassian to Isolde’s door; dread/hope unresolved | 5 | 6.3% | 289 | 182 | 1569 / 1540 | 900–1,200 / 900–1,200 | under 250 real words |
| scene5i | Soft net: Cassian surveils Maris instead of charging her | 5 | 6.3% | 1346 | 811 | 1659 / 1532 | 900–1,200 / 900–1,200 |  |
| scene5j | Soft net breaks — Maris burns a letter with Thorne’s seal | 5 | 6.3% | 877 | 499 | 1540 / 1578 | 900–1,200 / 900–1,200 | Hot much thinner than Warm |
| scene5k | Tip to Maris: guilt spiral; Cassian senses the leak | 5 | 6.3% | 644 | 406 | 1550 / 1552 | 900–1,200 / 900–1,200 |  |
| scene5l | Tip fallout: Cassian confronts her about obstruction | 5 | 6.3% | 663 | 387 | 1562 / 1533 | 900–1,200 / 900–1,200 | Hot much thinner than Warm |

### Batch 3: scene5m–scene6f (10 scenes)

| Scene | Title | Layer | Reach | Warm now | Hot now | Before W / H | Target W / H | Notes |
|---|---|---:|---:|---:|---:|---|---|---|
| scene5m | Maris names a drowned bell-tower beyond the Veil Sea fog | 5 | 6.3% | 534 | 335 | 1528 / 1558 | 900–1,200 / 900–1,200 | Warm ends on fragment ("Unmade pressed.") |
| scene5n | Maris names a Collegium badge half-heard in Thorne’s last night | 5 | 6.3% | 572 | 282 | 1560 / 1572 | 900–1,200 / 900–1,200 | Hot much thinner than Warm; Warm ends on fragment ("Copper bells muffled.") |
| scene5o | Cassian leans hard — she becomes the bad-cop shield for Maris | 5 | 6.3% | 521 | 313 | 1544 / 1536 | 900–1,200 / 900–1,200 |  |
| scene5p | Cassian leans hard — she walks out of the interrogation circle | 5 | 6.3% | 535 | 308 | 1567 / 1535 | 900–1,200 / 900–1,200 | Hot much thinner than Warm |
| scene6a | Full coop: she opens Isolde’s sealed drawer with Cassian | 6 | 6.3% | 1774 | 1527 | 1876 / 1675 | 900–1,200 / 900–1,200 | already over target: tighten, keep beats |
| scene6b | Full coop: she withholds one living-key page still | 6 | 6.3% | 1411 | 927 | 1609 / 1547 | 900–1,200 / 900–1,200 | in range: polish only |
| scene6c | Off-record night: intimacy + ward-map on the floor | 6 | 6.3% | 961 | 687 | 1585 / 1539 | 900–1,200 / 900–1,200 |  |
| scene6d | Off-record night: intimacy refused; war only | 6 | 6.3% | 795 | 501 | 1604 / 1568 | 900–1,200 / 900–1,200 |  |
| scene6e | Controlled drip: Isolde smells sandbagging | 6 | 6.3% | 526 | 306 | 1578 / 1558 | 900–1,200 / 900–1,200 | Hot much thinner than Warm |
| scene6f | Raw admission recorded — point of no return for the Collegium ledger | 6 | 6.3% | 420 | 278 | 1578 / 1521 | 900–1,200 / 900–1,200 |  |

### Batch 4: scene6g–scene6p (10 scenes)

| Scene | Title | Layer | Reach | Warm now | Hot now | Before W / H | Target W / H | Notes |
|---|---|---:|---:|---:|---:|---|---|---|
| scene6g | Bell-tower lead with Cassian before dawn | 6 | 6.3% | 810 | 313 | 1611 / 1560 | 900–1,200 / 900–1,200 | Hot much thinner than Warm; Hot ends on fragment ("Living-key fog stayed fog.") |
| scene6h | Bell-tower lead alone — she finds copper blood-rust and a cracked charm twin | 6 | 6.3% | 587 | 256 | 1606 / 1543 | 900–1,200 / 900–1,200 | Hot much thinner than Warm |
| scene6i | Isolde door: Cassian moves to relieve her; she watches | 6 | 6.3% | 1693 | 1281 | 1830 / 1525 | 900–1,200 / 900–1,200 | already over target: tighten, keep beats |
| scene6j | Isolde door: Collegium blowup without relief yet | 6 | 6.3% | 864 | 544 | 1564 / 1624 | 900–1,200 / 900–1,200 | Warm ends on fragment ("Relief waited unspent.") |
| scene6k | Burned letter ash: forensics from Maris’s grate | 6 | 6.3% | 737 | 466 | 1533 / 1624 | 900–1,200 / 900–1,200 |  |
| scene6l | Obstruction fight: break up / break open | 6 | 6.3% | 651 | 489 | 1579 / 1576 | 900–1,200 / 900–1,200 |  |
| scene6m | Bell-tower raid planning | 6 | 6.3% | 504 | 349 | 1584 / 1547 | 900–1,200 / 900–1,200 | Warm ends on fragment ("Blade oil.") |
| scene6n | Badge number: internal inquiry shadow on Cassian | 6 | 6.3% | 461 | 295 | 1614 / 1604 | 900–1,200 / 900–1,200 |  |
| scene6o | She shields Cassian from Isolde’s politics | 6 | 6.3% | 618 | 380 | 1583 / 1586 | 900–1,200 / 900–1,200 | Warm ends on fragment ("Blade oil.") |
| scene6p | She walks — Cassian has to chase both war and her | 6 | 6.3% | 453 | 312 | 1546 / 1626 | 900–1,200 / 900–1,200 |  |

### Batch 5: scene7a–scene7j (10 scenes)

| Scene | Title | Layer | Reach | Warm now | Hot now | Before W / H | Target W / H | Notes |
|---|---|---:|---:|---:|---:|---|---|---|
| scene7a | Sealed drawer: ledger names the living-key lineage — still short of her name confirmed | 7 | 6.3% | 1937 | 1615 | 2116 / 1801 | 900–1,200 / 900–1,200 | already over target: tighten, keep beats; Warm ends on fragment ("Partnership not harvest.") |
| scene7b | Withheld page: Cassian finds it anyway | 7 | 6.3% | 1670 | 1448 | 1856 / 1653 | 900–1,200 / 900–1,200 | already over target: tighten, keep beats; Warm ends on fragment ("Throat still hers.") |
| scene7c | Floor-map dawn: Bram IDs a second fracture pattern inland | 7 | 6.3% | 1425 | 1140 | 1622 / 1599 | 900–1,200 / 900–1,200 | in range: polish only |
| scene7d | War-only streak breaks — want returns mid-briefing | 7 | 6.3% | 1283 | 943 | 1857 / 1679 | 900–1,200 / 900–1,200 | in range: polish only; Warm ends on fragment ("War still real.") |
| scene7e | Isolde ultimatum: submit as key or be bound | 7 | 6.3% | 1422 | 823 | 1539 / 1599 | 900–1,200 / 900–1,200 | Hot much thinner than Warm |
| scene7f | Recording leaks toward the Collegium assembly | 7 | 6.3% | 1123 | 587 | 1905 / 1783 | 900–1,200 / 900–1,200 | Hot much thinner than Warm; Hot ends on fragment ("Calderyn thinned.") |
| scene7g | Bell-tower breach with Cassian | 7 | 6.3% | 1513 | 1593 | 1670 / 1912 | 900–1,200 / 900–1,200 | already over target: tighten, keep beats |
| scene7h | Charm twin + blood: a last hour reconstructed — Unmade still not fully mapped | 7 | 6.3% | 1241 | 1082 | 1545 / 1606 | 900–1,200 / 900–1,200 | in range: polish only; Warm ends on fragment ("Calderyn waited."); Hot ends on fragment ("Consequence first.") |
| scene7i | Isolde under inquiry: she visits | 7 | 6.3% | 1416 | 1394 | 1563 / 1654 | 900–1,200 / 900–1,200 | already over target: tighten, keep beats |
| scene7j | Isolde still seated: she wears a listening braid into council | 7 | 6.3% | 1490 | 1313 | 1582 / 1523 | 900–1,200 / 900–1,200 | already over target: tighten, keep beats |

### Batch 6: scene7k–scene8d (10 scenes)

| Scene | Title | Layer | Reach | Warm now | Hot now | Before W / H | Target W / H | Notes |
|---|---|---:|---:|---:|---:|---|---|---|
| scene7k | Ash-forensics: messages to a border prefect | 7 | 6.3% | 572 | 329 | 1642 / 1686 | 900–1,200 / 900–1,200 | Hot much thinner than Warm |
| scene7l | Break-open: she and Cassian choose each other mid-war | 7 | 6.3% | 493 | 295 | 1563 / 1578 | 900–1,200 / 900–1,200 | Hot much thinner than Warm |
| scene7m | Raid: hold/don’t-hold the ward-line | 7 | 6.3% | 238 | 161 | 1645 / 1563 | 900–1,200 / 900–1,200 | under 250 real words |
| scene7n | Inquiry: Cassian under review for closeness to candidate | 7 | 6.3% | 254 | 157 | 1598 / 1571 | 900–1,200 / 900–1,200 | under 250 real words; Hot ends on fragment ("Consent loud.") |
| scene7o | Politics: she goes public to protect Cassian | 7 | 6.3% | 222 | 129 | 1566 / 1705 | 900–1,200 / 900–1,200 | under 250 real words; Hot much thinner than Warm |
| scene7p | Chase: reunion at the cliff festival of bells | 7 | 6.3% | 197 | 156 | 1563 / 1551 | 900–1,200 / 900–1,200 | under 250 real words |
| scene8a | Ledger public: name the living-key chain | 8 | 6.3% | 1241 | 957 | 1573 / 1671 | 900–1,200 / 900–1,200 | in range: polish only; Warm ends on fragment ("Person first.") |
| scene8b | Ledger private: bargain with Isolde | 8 | 6.3% | 809 | 588 | 1654 / 1568 | 900–1,200 / 900–1,200 | Warm ends on fragment ("Person first.") |
| scene8c | Page truth: she reads it aloud to Cassian in bed | 8 | 6.3% | 680 | 533 | 1681 / 1585 | 900–1,200 / 900–1,200 |  |
| scene8d | Page burned: mercy or cowardice | 8 | 6.3% | 561 | 456 | 1679 / 1680 | 900–1,200 / 900–1,200 | Warm ends on fragment ("Calderyn failed by inches.") |

### Batch 7: scene8e–scene8n (10 scenes)

| Scene | Title | Layer | Reach | Warm now | Hot now | Before W / H | Target W / H | Notes |
|---|---|---:|---:|---:|---:|---|---|---|
| scene8e | Second fracture: widen the war map | 8 | 6.3% | 518 | 417 | 1625 / 1625 | 900–1,200 / 900–1,200 |  |
| scene8f | Second fracture: keep Ashmere the only name | 8 | 6.3% | 465 | 346 | 1678 / 1689 | 900–1,200 / 900–1,200 |  |
| scene8g | Tower endgame: catch the prefect | 8 | 6.3% | 475 | 366 | 1682 / 1591 | 900–1,200 / 900–1,200 | Warm ends on fragment ("Ozone burned the sinuses.") |
| scene8h | Tower endgame: Isolde confesses partially | 8 | 6.3% | 499 | 349 | 1581 / 1560 | 900–1,200 / 900–1,200 | Warm ends on fragment ("Ozone burned.") |
| scene8i | Listening braid: Isolde incriminates the prefect | 8 | 6.3% | 992 | 803 | 1544 / 1546 | 900–1,200 / 900–1,200 |  |
| scene8j | Listening braid fails: she is made | 8 | 6.3% | 722 | 470 | 1554 / 1543 | 900–1,200 / 900–1,200 |  |
| scene8k | Prefects’ chain: assembly broadcast | 8 | 6.3% | 595 | 317 | 1541 / 1526 | 900–1,200 / 900–1,200 | Hot much thinner than Warm; Hot ends on fragment ("Unmade pressed the cliff.") |
| scene8l | Prefects’ chain: quiet deal | 8 | 6.3% | 514 | 271 | 1532 / 1527 | 900–1,200 / 900–1,200 | Hot much thinner than Warm; Warm ends on fragment ("Consequence waiting.") |
| scene8m | Raid aftermath: Cassian wounded lightly | 8 | 6.3% | 479 | 295 | 1533 / 1534 | 900–1,200 / 900–1,200 | Warm ends on fragment ("Fog climbing.") |
| scene8n | Inquiry hearing: testify for Cassian | 8 | 6.3% | 559 | 286 | 1540 / 1542 | 900–1,200 / 900–1,200 | Hot much thinner than Warm; Warm ends on fragment ("War refusing to pause.") |

### Batch 8: scene8o–scene9h (10 scenes)

| Scene | Title | Layer | Reach | Warm now | Hot now | Before W / H | Target W / H | Notes |
|---|---|---:|---:|---:|---:|---|---|---|
| scene8o | Public storm: they hide together in the lower wards | 8 | 6.3% | 471 | 215 | 1537 / 1525 | 900–1,200 / 900–1,200 | under 250 real words; Hot much thinner than Warm; Warm ends on fragment ("Heat leapt.") |
| scene8p | Cliff anniversary: proposal of truth not marriage | 8 | 6.3% | 491 | 262 | 1542 / 1527 | 900–1,200 / 900–1,200 | Hot much thinner than Warm |
| scene9a | Binding path: submit fully as living key with Cassian at her back | 9 | 18.8% | 738 | 518 | 1538 / 1545 | 900–1,200 / 900–1,200 | Warm ends on fragment ("Want was not weakness.") |
| scene9b | Binding path: submit with a mercy rewrite of the sacrifice | 9 | 12.5% | 519 | 335 | 1623 / 1537 | 900–1,200 / 900–1,200 |  |
| scene9c | Broadcast path: blow the Collegium open | 9 | 12.5% | 420 | 238 | 1521 / 1523 | 900–1,200 / 900–1,200 | under 250 real words; Hot much thinner than Warm; Warm ends on fragment ("Consequence first."); Hot ends on fragment ("Soft was dead.") |
| scene9d | Quiet deal: seal parts of the living-key file | 9 | 9.4% | 317 | 169 | 1572 / 1544 | 900–1,200 / 900–1,200 | under 250 real words; Hot much thinner than Warm; Warm ends on fragment ("Consequence first.") |
| scene9e | Prefect caught: Thorne’s mortal agent named | 9 | 12.5% | 309 | 142 | 1545 / 1535 | 900–1,200 / 900–1,200 | under 250 real words; Hot much thinner than Warm; Hot ends on fragment ("Soft was dead.") |
| scene9f | Prefect escapes: Cassian hunts; she waits at the ward-line | 9 | 9.4% | 254 | 138 | 1526 / 1561 | 900–1,200 / 900–1,200 | under 250 real words; Hot much thinner than Warm; Warm ends on fragment ("Consequence first.") |
| scene9g | Hospital dawn: Cassian and her future | 9 | 12.5% | 305 | 151 | 1550 / 1524 | 900–1,200 / 900–1,200 | under 250 real words; Hot much thinner than Warm |
| scene9h | Cliff dawn: leave Ashmere or stay | 9 | 12.5% | 297 | 121 | 1564 / 1564 | 900–1,200 / 900–1,200 | under 250 real words; Hot much thinner than Warm; Warm ends on fragment ("Consequence first.") |

## Under 250 real words in either version: 18 scenes

scene4d (W 621 / H 243), scene4g (W 553 / H 130), scene4h (W 554 / H 230), scene5e (W 408 / H 183), scene5f (W 316 / H 193), scene5g (W 296 / H 181), scene5h (W 289 / H 182), scene7m (W 238 / H 161), scene7n (W 254 / H 157), scene7o (W 222 / H 129), scene7p (W 197 / H 156), scene8o (W 471 / H 215), scene9c (W 420 / H 238), scene9d (W 317 / H 169), scene9e (W 309 / H 142), scene9f (W 254 / H 138), scene9g (W 305 / H 151), scene9h (W 297 / H 121)

## Open structural items (not part of the rewrite itself)

- Graph is sound: every scene is reachable, no dead ends, all choice targets exist.
- Choice labels were shortened where they were truncated (6k/6l→7l, 6l/6m→7m, 6m/6n→7n, 6p→7a) and the L9→L10 labels no longer print ending names. Many L5–L8 labels are still title-style ("Binding path: …", "Tower endgame: …"). Rewrite them as short in-story actions alongside each batch.
- Titles 7a ("… still short of her name confirmed") and several L4–L6 titles read like planning notes. Titles show in resume labels, so tighten them in the batch that owns the scene.
- 32 scenes have Hot much thinner than Warm. The padding sat mostly in Hot.
