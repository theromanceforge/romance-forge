# Phase 3 — Free-tier ads (LOCKED brief)

**Status:** **Implemented (wiring)** 2026-09-24 — CEO Jake GO. Live AdSense fill still needs publisher approval + GitHub Actions secrets.

**North star:** monetize the free path with ads; paid ad-less stays Phase 6.

## Locked decisions

### 1. Placement — max 2 interstitials per story (mid + end)

- **Cap:** at most **2** interstitials per story session (`storyId` + browser sessionStorage).
- **Mid:** between-scene after a choice once the path is roughly mid-story (`pathLength >= 5`) and no ad has been shown yet for this story.
- **End:** soft post-play interstitial when returning to landing after finish (`reason === 'post-play'`), when under the cap.
- Between-scene does **not** fire after every choice — only the mid slot; after mid is used, between-scene stays off.
- Also allowed historically: soft “continue?” between layers (same gate; still under the cap).
- **No** catalog/landing banners in Phase 3 (low intent, trains bounce before Start).
- Per-story counts: `sessionStorage` key `romanceForge.adsByStory`. Reset on start-fresh / fresh Begin.

### 2. Vendor — Google AdSense first

- Host is GitHub Pages → prefer a client-side network with fill.
- Start with **AdSense**. If adult/romance policy rejects the property, fall back to a lighter adult-friendly network — do not start on a boutique vendor.
- One vendor at a time; easy rip-out.
- Load AdSense **only** when `VITE_ADS_ENABLED=true` **and** `VITE_ADSENSE_CLIENT_ID` is set. With enable + no client id, a branded interstitial placeholder keeps the UX path testable without breaking play.

### 3. Never-interrupt — hard list

**Safe**

- Mid-path between-scene (once, ~pathLength >= 5)
- Soft between-layer continue (under cap)
- Post-play landing (end slot)

**Forbidden**

- Mid-paragraph / over Warm or Hot body prose
- L10 ending reveals
- Auth, save, or resume flows
- First scene of a new session (don’t tax the hook)

## Env / kill switch (Pages-safe)

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_ADS_ENABLED` | Master kill switch (`true` / `false`) | unset / false — **no ad UI** |
| `VITE_ADSENSE_CLIENT_ID` | AdSense publisher id (`ca-pub-…`) | empty → placeholder interstitial |
| `VITE_ADSENSE_SLOT` | Optional ad unit slot | empty |

Set these as **GitHub Actions repository secrets** (same pattern as Supabase). The Pages workflow passes them into `npm run build`. Do **not** commit `.env.local` or real `ca-pub` values.

**CEO / Publisher:** after AdSense site approval, set the three secrets and push or re-run the deploy workflow. Until then leave unset — play is unchanged.

## Implementation map

- `src/ads/config.js` — env kill switch
- `src/ads/shouldShow.js` — `shouldShowInterstitial` gate (unit-tested)
- `src/ads/interstitial.js` — overlay + optional AdSense inject (fail soft)
- `src/ads/stats.js` — light counters + `window.__rfAdsStats` + per-story `romanceForge.adsByStory`
- Hooked from `src/main.js` choice → advance path only (story modules untouched)

## Measurement (light)

Session counters: interstitial `shown`, `continue`, `skip`, `sceneAdvance`. Inspect `window.__rfAdsStats` in the browser console. Not a full analytics stack.

## Required for ship (checklist)

- [x] Kill switch via env (no code change to disable)
- [x] Free path only (guest + free; no paywall)
- [x] Light measurement
- [x] Warm/Hot contract and story prose unchanged
- [ ] Live AdSense fill (external: publisher approval + secrets)

## Out of scope

- Reviews / CS (Phase 4)
- Algorithm push (Phase 5)
- Paid remove-ads / subscriptions (Phase 6)
- Digests / player event hooks (separate parked track)
