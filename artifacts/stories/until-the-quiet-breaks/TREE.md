# Until the Quiet Breaks — Choice tree (Layers 1–10)

**Total: 97 scenes** across 10 layers. Non-endings: exactly two outbound IDs. Layer 10: distinct endings (`choices: []`).

Spice: Warm (`text`) and Hot (`textHot`) share the same choice IDs — the TREE does not fork by heat.

## Layer counts

| Layer | Count | IDs | Choices |
|------:|------:|-----|---------|
| 1 | 1 | `scene1` | 2 |
| 2 | 2 | `scene2a`–`2b` | 2 each |
| 3 | 4 | `scene3a`–`3d` | 2 each |
| 4 | 8 | `scene4a`–`4h` | 2 each |
| 5 | 16 | `scene5a`–`5p` | 2 each |
| 6 | 16 | `scene6a`–`6p` | 2 each |
| 7 | 16 | `scene7a`–`7p` | 2 each |
| 8 | 16 | `scene8a`–`8p` | 2 each |
| 9 | 8 | `scene9a`–`9h` | 2 each |
| 10 | 10 | `scene10a`–`10j` | none (endings) |

**Convergence:** L4→L5 is 1:1 (8×2=16). L5–L8 use shared landings (32 arrows → 16 nodes). L8→L9 compresses to 8. L9→L10 maps 16 arrows onto 10 endings.

## Layer 1

### scene1 — Somerton Station (~550w)
- **→ scene2a** — Find the blue door — seek John at the diner
- **→ scene2b** — Walk to Willow Lane — face Henry first

## Layer 2

### scene2a — The Diner (John)
- **→ scene3a** — Stay through the dinner rush — talk with John alone
- **→ scene3b** — Ask John to walk you to Willow — face Henry together

### scene2b — Willow Lane (Henry)
- **→ scene3c** — Press Henry for the whole truth now
- **→ scene3d** — Leave for the diner — hear John's side before Henry finishes

## Layer 3

### scene3a — Dinner Rush (from 2a)
- **→ scene4a** — Lean into the spark — kiss him before the secret lands
- **→ scene4b** — Hold the line — demand the truth before any closeness

### scene3b — Walk to Willow (from 2a)
- **→ scene4c** — Let John speak for you when Henry opens the door
- **→ scene4d** — Take the lead — confront Henry yourself

### scene3c — Henry Pressed (from 2b)
- **→ scene4e** — Believe Henry enough to go find John with open hands
- **→ scene4f** — Doubt him — search the house with Clara's sketches as a map

### scene3d — Back to the Blue Door (from 2b)
- **→ scene4g** — Tell John everything Henry hinted at
- **→ scene4h** — Shield John from Henry's version — ask only what he remembers of the night you left

## Layer 4

### scene4a — The Almost
- **→ scene5a** — Pull Clara into the booth — read the papers with John present
- **→ scene5b** — Kiss him once more — then face the papers alone with Clara

### scene4b — The Demand
- **→ scene5c** — Tell him the winter debt out loud before dawn
- **→ scene5d** — Ask him to hold you through the rain first — truth at first light

### scene4c — The Advocate
- **→ scene5e** — Stay in Henry's silence until he breaks
- **→ scene5f** — Take John outside — decide what the family will say next

### scene4d — The Indictment
- **→ scene5g** — Force Henry to name the creditor who still shadows the Shaws
- **→ scene5h** — Walk John to the diner — let the indictment travel with you

### scene4e — Open Hands
- **→ scene5i** — Kiss John with the open secret still unnamed
- **→ scene5j** — Put the letter on the counter — make him read Henry's words

### scene4f — The Sketches
- **→ scene5k** — Follow Clara's margins to the shed key and the missing ledger
- **→ scene5l** — Bring the sketches to John before Henry can reclaim them

### scene4g — The Spill
- **→ scene5m** — Stay and weather John's anger until it softens
- **→ scene5n** — Leave him the night — return with Clara's proof in hand

### scene4h — Shared Memory
- **→ scene5o** — Open the blue door together — face whoever knocks
- **→ scene5p** — Lock it — finish rebuilding the night before any uncle enters

## Layer 5

| ID | Title | Choice A | Choice B |
|----|-------|----------|----------|
| `scene5a` | Papers in the Booth | → `scene6a` — Show John every line Clara circled | → `scene6b` — Hide the ugliest page — protect him one more hour |
| `scene5b` | Kiss Then Evidence | → `scene6b` — Let Clara narrate what she found | → `scene6c` — Send Clara out — ask John what he wants from you tonight |
| `scene5c` | Debt Before Dawn | → `scene6d` — Drive to Willow and wake Henry with the number | → `scene6e` — Call the creditor's old exchange from the diner phone |
| `scene5d` | Rain First | → `scene6e` — At first light, demand the full cover story | → `scene6f` — At first light, ask John to choose you over the Shaw quiet |
| `scene5e` | Henry's Silence | → `scene6g` — Confess your part in the cover before he speaks | → `scene6h` — Threaten to tell the Market Street regulars everything |
| `scene5f` | Outside Willow | → `scene6h` — Plan a private family council with Clara | → `scene6i` — Kiss John in the wet boxwood — steal one honest hour |
| `scene5g` | Name the Creditor | → `scene6j` — Go with Henry to settle the ghost debt | → `scene6k` — Refuse Henry's money — demand only the truth spoken to John |
| `scene5h` | Indictment Travels | → `scene6k` — Tell Clara first so she isn't blindsided | → `scene6l` — Tell the story only to John behind the locked blue door |
| `scene5i` | Open-Secret Kiss | → `scene6c` — After, open Henry's letter together | → `scene6g` — After, go to Willow before courage cools |
| `scene5j` | Letter on the Counter | → `scene6a` — Stay while John reads — answer every question | → `scene6m` — Give him space; wait at Willow with Clara |
| `scene5k` | Shed and Ledger | → `scene6n` — Open the ledger with Clara before anyone else | → `scene6o` — Bring John to the shed — no more secondhand truth |
| `scene5l` | Sketches to John | → `scene6o` — Sit with him while he studies Clara's margins | → `scene6p` — Ask him not to forgive Henry yet |
| `scene5m` | Weather His Anger | → `scene6f` — Apologize for the fifteen-year silence without excuses | → `scene6p` — Refuse to apologize for surviving — ask him to hear why |
| `scene5n` | Night Apart | → `scene6m` — Return at dawn with Clara and the sketches | → `scene6i` — Return alone — offer your body and your confession together |
| `scene5o` | Open the Knock | → `scene6d` — Let Henry in and refuse to soften the night's truth | → `scene6n` — Let Clara answer — she found the crack |
| `scene5p` | Lock the Door | → `scene6l` — Finish the shared memory into a vow | → `scene6j` — Finish it into a plan to end the cover story |

## Layer 6

| ID | Title | Choice A | Choice B |
|----|-------|----------|----------|
| `scene6a` | Every Circled Line | → `scene7a` — Burn nothing — photocopy and confront Henry at noon | → `scene7b` — Keep the papers but ask John what justice looks like |
| `scene6b` | Ugliest Page Held | → `scene7b` — Show him the page anyway before it owns you | → `scene7c` — Take the page to Clara for a second reading |
| `scene6c` | What He Wants Tonight | → `scene7d` — Choose heat without answers until morning | → `scene7e` — Choose answers first — touch only after |
| `scene6d` | Wake Henry | → `scene7f` — Make him confess in front of John | → `scene7g` — Make him confess to you alone, then relay |
| `scene6e` | Old Exchange | → `scene7h` — Leave a message that the Shaws are done running | → `scene7i` — Hang up — the past doesn't get a callback |
| `scene6f` | Choose You | → `scene7d` — Accept his choice and seal it with a public claim | → `scene7j` — Accept his choice but keep the secret a little longer |
| `scene6g` | Your Part Spoken | → `scene7g` — Ask Henry for forgiveness you may not give | → `scene7a` — Refuse forgiveness — demand restitution |
| `scene6h` | Market Street Threat | → `scene7h` — Follow through: tell Mae at the post office | → `scene7f` — Bluff withdrawn — use the threat only on Henry |
| `scene6i` | Hour in Boxwood | → `scene7k` — Let the hour become a night at his flat above the diner | → `scene7c` — Cut the hour short — Clara is waiting with keys |
| `scene6j` | Settle Ghost Debt | → `scene7l` — Pay with Henry and close the ledger forever | → `scene7a` — Refuse payment — expose the debt instead |
| `scene6k` | Truth Not Money | → `scene7e` — Bring John into the refusal | → `scene7g` — Shield John; carry the refusal yourself |
| `scene6l` | Locked Blue Door Story | → `scene7c` — When you finish, invite Clara in | → `scene7f` — When you finish, go to Henry before dawn |
| `scene6m` | Wait at Willow | → `scene7n` — Use the wait to search Henry's desk again | → `scene7o` — Use the wait to prepare Clara for John's rage |
| `scene6n` | Ledger First | → `scene7n` — Photograph every page for safekeeping | → `scene7a` — Confront Henry with the original in hand |
| `scene6o` | Shed with John | → `scene7p` — Let him break what needs breaking | → `scene7e` — Hold him back — breaking won't rewrite the dead |
| `scene6p` | Not Yet Forgive | → `scene7p` — Stand with him in unforgiveness | → `scene7b` — Ask him to leave room for later mercy |

## Layer 7

| ID | Title | Choice A | Choice B |
|----|-------|----------|----------|
| `scene7a` | Noon Confrontation | → `scene8a` — Record Henry's confession on your phone | → `scene8b` — Refuse recording — demand a written statement |
| `scene7b` | Justice His Shape | → `scene8c` — Agree to John's terms even if they scare you | → `scene8d` — Negotiate — your life is not only his wound |
| `scene7c` | Clara Second Reading | → `scene8e` — Let Clara decide who hears first | → `scene8c` — Overrule her gently — John must hear first |
| `scene7d` | Heat Until Morning | → `scene8f` — At dawn, tell him you love him before the secret | → `scene8g` — At dawn, put the papers between you on the bed |
| `scene7e` | Answers Then Touch | → `scene8f` — After answers, stay — rebuild trust with your body | → `scene8a` — After answers, go confront Henry while fire is hot |
| `scene7f` | Confess Before John | → `scene8h` — Hold John's hand while Henry speaks | → `scene8i` — Stand apart — let John face his uncle alone |
| `scene7g` | Relay Alone | → `scene8g` — Softening nothing when you tell John | → `scene8j` — Softening only the parts that would destroy him |
| `scene7h` | Tell Mae | → `scene8k` — Own the town gossip as the cost of truth | → `scene8l` — Ask Mae to hold it forty-eight hours |
| `scene7i` | No Callback | → `scene8l` — Burn the creditor's number in the diner sink | → `scene8b` — Keep the number — leverage for Henry |
| `scene7j` | Secret a Little Longer | → `scene8j` — Set a deadline: one week, then full disclosure | → `scene8c` — Admit you're afraid and ask John to decide the deadline |
| `scene7k` | Night Above the Diner | → `scene8f` — Make it a claim — you're not leaving this time | → `scene8d` — Make it a question — ask if he can love the woman who lied |
| `scene7l` | Close the Ledger | → `scene8m` — Celebrate the closed debt with fragile hope | → `scene8n` — Feel the cost — ask what Henry sacrificed to pay |
| `scene7m` | Search Desk Again | → `scene8n` — Find the second letter Henry never mailed | → `scene8o` — Find nothing new — accept the known wound |
| `scene7n` | Photograph Pages | → `scene8k` — Send copies to a lawyer outside Somerton | → `scene8e` — Give copies only to Clara and John |
| `scene7o` | Prepare Clara | → `scene8m` — Promise her you won't abandon the family again | → `scene8o` — Promise her only honesty — not forever |
| `scene7p` | Break or Hold | → `scene8i` — Let John smash the shed lock; stay with the wreckage | → `scene8d` — Pull him into the rain and choose living over wreckage |

## Layer 8

| ID | Title | Choice A | Choice B |
|----|-------|----------|----------|
| `scene8a` | Recorded Confession | → `scene9a` — Release the recording to John and Clara only | → `scene9b` — Hold the recording as insurance — speak live instead |
| `scene8b` | Written Statement | → `scene9a` — Notarize Henry's statement at the county office | → `scene9e` — Burn the statement after John reads it — no paper trail |
| `scene8c` | John's Terms | → `scene9b` — Accept a life rebuilt in Somerton on his terms | → `scene9c` — Accept love but refuse to erase your years away |
| `scene8d` | Negotiate the Wound | → `scene9c` — Insist on couples honesty before family spectacle | → `scene9f` — Insist Henry faces consequences in public |
| `scene8e` | Clara Chooses Audience | → `scene9d` — Support her choice even if it scares you | → `scene9b` — Ask her to delay for John's sake |
| `scene8f` | Love Before Secret | → `scene9c` — Tell the secret the same morning | → `scene9e` — Keep the secret one more day after the vow |
| `scene8g` | Papers on the Bed | → `scene9d` — Read them aloud until nothing is left unsaid | → `scene9a` — Stop midway — some pages are Henry's alone to confess |
| `scene8h` | Hand in Hand | → `scene9g` — Forgive Henry in John's hearing | → `scene9b` — Refuse forgiveness; keep holding John's hand |
| `scene8i` | John Alone with Henry | → `scene9e` — Wait outside; trust him to return | → `scene9a` — Interrupt if the silence lasts too long |
| `scene8j` | Softened Relay | → `scene9d` — Admit you softened it — offer the raw version | → `scene9g` — Stand by the mercy you chose |
| `scene8k` | Town Cost | → `scene9f` — Face Market Street together tomorrow | → `scene9h` — Leave town for a week while talk burns out |
| `scene8l` | Forty-Eight Hours | → `scene9c` — Use the hours to marry your stories in private | → `scene9g` — Use the hours to finish Henry's exile papers |
| `scene8m` | Fragile Hope | → `scene9g` — Throw a quiet diner reopen for the family only | → `scene9h` — Skip celebration — go to the station and decide |
| `scene8n` | Second Letter / Cost | → `scene9a` — Read Henry's unsent letter to John | → `scene9e` — Give John the choice to read or not |
| `scene8o` | Honesty Not Forever | → `scene9h` — Book a return ticket and tell him the date | → `scene9c` — Cancel the ticket — try staying without promises |
| `scene8p` | Rain Over Wreckage | → `scene9d` — Go back inside and start cleaning the truth | → `scene9h` — Walk to the station in the rain — ending undecided |

## Layer 9

| ID | Title | Choice A | Choice B |
|----|-------|----------|----------|
| `scene9a` | Insurance and Kin | → `scene10a` — Choose full disclosure with John — build a life in daylight | → `scene10i` — Choose a sealed family archive — love with careful silence |
| `scene9b` | Somerton on His Terms | → `scene10h` — Stay and love him inside the town's new noise | → `scene10b` — Stay beside him but keep one page sealed for now |
| `scene9c` | Honesty Before Spectacle | → `scene10a` — Commit to John without erasing your years away | → `scene10j` — Commit to trying — leave a soft door to leave |
| `scene9d` | Clara's Stage | → `scene10e` — Stand behind Clara as she rewrites the family aloud | → `scene10f` — Ask Clara to let Henry speak last for redemption |
| `scene9e` | Mercy and Deadlines | → `scene10h` — End the cover story this week — no extensions | → `scene10f` — Extend mercy to Henry; shorten mercy to the lie |
| `scene9f` | Public Consequences | → `scene10g` — Push for Henry's public accounting | → `scene10h` — Push for town truth without destroying Henry |
| `scene9g` | Forgive or Exile | → `scene10f` — Vote with John to keep Henry at Willow in grace | → `scene10g` — Vote with John to cut Henry out of the diner's future |
| `scene9h` | Station Undecided | → `scene10c` — Board the train alone — free of the lie | → `scene10j` — Pull John onto the platform — unfinished promise |

## Layer 10 — endings (`choices: []`)

| ID | Ending | Destination |
|----|--------|-------------|
| `scene10a` | Together in Truth | John and [player_name] stay; the secret is spoken; the diner opens in daylight. |
| `scene10b` | Soft Rebuild | Love holds while a partial silence still heals; the quiet is thinner, not gone. |
| `scene10c` | Leave Free | She leaves Somerton unburdened; John respects the freedom he once lost. |
| `scene10d` | Stay Cold | She remains in town without John — present, untied, unfinished. |
| `scene10e` | Clara's Reckoning | Clara leads the family's new story; the sisters-in-all-but-blood set the terms. |
| `scene10f` | Henry Redeemed | Forgiveness lands; Willow reopens; Henry earns a smaller, honest place. |
| `scene10g` | Henry Exiled | Costly justice; Henry is cut from the diner's future; the wound is named. |
| `scene10h` | Open Secret | Market Street knows; they endure the noise together. |
| `scene10i` | Quiet Resealed | The secret is buried again; love or peace costs more than it gives. |
| `scene10j` | Bittersweet Train | The platform holds an unfinished promise — departure and devotion in the same rain. |

## Path map (Layers 1–4)

```
scene1
├─ scene2a ─┬─ scene3a ─┬─ scene4a ─┬─ scene5a
│           │           │           └─ scene5b
│           │           └─ scene4b ─┬─ scene5c
│           │                       └─ scene5d
│           └─ scene3b ─┬─ scene4c ─┬─ scene5e
│                       │           └─ scene5f
│                       └─ scene4d ─┬─ scene5g
│                                   └─ scene5h
└─ scene2b ─┬─ scene3c ─┬─ scene4e ─┬─ scene5i
            │           │           └─ scene5j
            │           └─ scene4f ─┬─ scene5k
            │                       └─ scene5l
            └─ scene3d ─┬─ scene4g ─┬─ scene5m
                        │           └─ scene5n
                        └─ scene4h ─┬─ scene5o
                                    └─ scene5p
```

Layers 5–10: see tables above. Tracks weave **Truth** (papers/Henry/creditor), **Heart** (John intimacy), **Clara** (evidence/agency), and **Reckoning** (town/public vs private).

