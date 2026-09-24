# Phase 4 — Reviews + CS (brief — lock before build)

**Status:** **Implemented** (wiring) 2026-09-24 — CEO Jake GO. Guest path works without Supabase; cloud path requires applying `scripts/apply-reviews-schema.sql` (or `npm run schema:reviews`).

**North star:** finished playthroughs leave a public signal (stars + short review) and a clear path to human CS — trust before algorithm push (Phase 5) and paid ad-less (Phase 6).

## Recommended locks

### 1. When to ask — end of play only

- Show the review prompt **only after an L10 ending** (story complete), never mid-tree.
- One prompt per story per account (guest: once per browser/story via local flag; signed-in: once per user/story in cloud).
- Dismissible forever for that story (“Not now” / close). Never block Restart or catalog return.
- **Forbidden:** over Hot body, during choices, over interstitial ads, on first scene, during auth/save/resume.

### 2. What we collect — light, story-scoped

| Field | Required | Notes |
| --- | --- | --- |
| Star rating | Yes | 1–5 |
| Short text | No | Max ~280 chars; wine-and-smut tone OK if it stays non-hateful |
| Display name | No | Default from account name / guest “Reader”; no email in public card |
| Spice mode played | Auto | Warm or Hot — stored for ops, optional chip on card |
| Story id | Auto | e.g. `the-soft-alibi` |

No photos, no cross-story dumps, no required account to leave a guest review (guest reviews stay device-local until Phase 4.1 moderation/cloud if we add it).

### 3. Where it shows

- **After ending:** thank-you + stars + optional text + Submit / Skip.
- **Catalog card:** average stars + count when ≥1 review (hide count at 0).
- **Story landing / reader chrome:** compact “Readers say” strip (latest 3 approved) — skip if zero.
- Not on the between-scene ad interstitial.

### 4. Storage — guest local first, cloud for signed-in

- **Guest:** `localStorage` keyed by story id (same pattern as guest saves). Enough to prove UX; not global social proof.
- **Signed-in:** Supabase table `reviews` (user_id, story_slug, stars, body, spice, created_at) with RLS: users insert/update own row; **public read only of `approved=true`** rows.
- Moderation: new cloud reviews default `approved=false` until CS Jake (or staff) approves — or auto-approve if you prefer launch speed (decision at GO).

**Recommended at GO:** auto-approve signed-in reviews for v1, with a kill/hide flag per row for CS takedowns. Guest reviews never appear on other devices until we add optional “publish as guest” later (out of Phase 4).

### 5. CS path

- In-app: footer + ending screen link **Contact CS** → `mailto:theromanceforge@gmail.com` with subject prefilled `Romance Forge CS — {story}`.
- Optional small form later; **mailto is enough for Phase 4**.
- No chatbot. No public ticket queue in-app.

### 6. Out of scope (Phase 4)

- Algorithm / discovery push (Phase 5)
- Paid remove-ads (Phase 6)
- Digests / event hooks (separate parked track — can consume review events later)
- Full forum, replies-to-reviews, or spoiler moderation AI
- Changing Warm/Hot prose or ad placement rules

## Locked decisions (CEO Jake 2026-09-24)

1. **Guest reviews:** local-only (not shown on other devices).
2. **Cloud moderation:** auto-approve signed-in reviews + CS hide/takedown flag.
3. **CS inbox:** `theromanceforge@gmail.com`.

## Ship bar

- Ending → review prompt → stars submit works guest + signed-in
- Catalog shows average when data exists
- CS mailto reachable from ending + footer
- Tests for “only after ending” and “never mid-prose / mid-ad”
- Docs updated; no secrets in repo

## Go / no-go

CEO Jake locked the three decisions and said **GO** (2026-09-24). Wiring shipped.

### Apply cloud schema (staff)

```bash
npm run schema:reviews
# or paste scripts/apply-reviews-schema.sql in Supabase SQL Editor
```

Guest local reviews work with no schema. Catalog public stars appear only after cloud reviews exist and the table is applied.
