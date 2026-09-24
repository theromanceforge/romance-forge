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

In Supabase Auth settings, include this URL in both the Site URL and Redirect URLs:

`https://theromanceforge.github.io/romance-forge/`
