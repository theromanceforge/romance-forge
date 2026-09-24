# GitHub Pages deployment

Live site: https://theromanceforge.github.io/romance-forge/

This repository deploys to GitHub Pages automatically when changes are pushed to
`main`. The GitHub Actions workflow checks out the app, installs dependencies with
`npm ci`, builds the Vite production bundle, uploads `dist`, and deploys it with
GitHub Pages.

## GitHub Secrets

Configure these repository secrets for cloud auth and saves during the Pages build:

- `VITE_SUPABASE_URL` (required)
- `VITE_SUPABASE_ANON_KEY` (required)
- `VITE_SUPABASE_PUBLISHABLE_KEY` (optional; supported by the client)

`SUPABASE_SECRET_KEY` is a server-side secret and must **never** be a GitHub Secret
used by GitHub Pages builds or exposed to the browser.

## Free-tier ads (Phase 3)

Optional — leave unset until AdSense is approved. Default build has ads **off**.

- `VITE_ADS_ENABLED` (`true` to turn on; omit or `false` to kill without code change)
- `VITE_ADSENSE_CLIENT_ID` (`ca-pub-…` publisher id; without it, a branded placeholder interstitial is used when enabled)
- `VITE_ADSENSE_SLOT` (optional ad unit slot)

CEO/Publisher sets these Actions secrets after AdSense approval. Never commit real values.

In Supabase Auth settings, include this URL in both the Site URL and Redirect URLs:

`https://theromanceforge.github.io/romance-forge/`

## Phase 4 reviews (signed-in cloud)

No new GitHub Secrets. Reuses `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (or publishable key).

Staff must apply the reviews DDL once per project:

```bash
npm run schema:reviews
# fallback: Supabase Dashboard → SQL Editor → scripts/apply-reviews-schema.sql
```

Guest reviews use `localStorage` only and do not need this schema. Until the table exists, catalog public star averages simply stay hidden (fail soft).

