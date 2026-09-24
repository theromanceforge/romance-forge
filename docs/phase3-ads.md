# Phase 3 — Free-tier ads (LOCKED brief)

**Status:** decisions locked 2026-09-24. **Not implemented** until CEO Jake says go.

**North star:** monetize the free path with ads; paid ad-less stays Phase 6.

## Locked decisions

### 1. Placement — between-scene interstitial only

- Show an ad **after** a choice resolves and **before** the next scene loads.
- Also allowed: soft “continue?” between layers; post-play return to landing/catalog.
- **No** catalog/landing banners in Phase 3 (low intent, trains bounce before Start).

### 2. Vendor — Google AdSense first

- Host is GitHub Pages → prefer a client-side network with fill.
- Start with **AdSense**. If adult/romance policy rejects the property, fall back to a lighter adult-friendly network — do not start on a boutique vendor.
- One vendor at a time; easy rip-out.

### 3. Never-interrupt — hard list

**Safe**

- After choice click → before next scene
- Soft between-layer continue
- Post-play landing

**Forbidden**

- Mid-paragraph / over Warm or Hot body prose
- L10 ending reveals
- Auth, save, or resume flows
- First scene of a new session (don’t tax the hook)

## Required for ship

- **Kill switch:** turn ads off without a full redeploy (env/flag or remote config).
- Free path only (guest + free account). No paywall in Phase 3.
- Light measurement: ad impression vs scene advance — enough to see if ads hurt completion. Not a full analytics rebuild.
- Warm/Hot contract and story prose unchanged.

## Out of scope

- Reviews / CS (Phase 4)
- Algorithm push (Phase 5)
- Paid remove-ads / subscriptions (Phase 6)
- Digests / player event hooks (separate parked track)

## Open at implement time (not blocking the lock)

- AdSense publisher account + site approval
- Exact interstitial UI (duration, skip rule, spicy-safe creative filters if the network allows)
- Env name for the kill switch / client id

## Go / no-go

Do **not** write ad code, add scripts, or open an AdSense application from staff until CEO Jake explicitly says to start Phase 3 implementation.
