# First-party analytics + daily brief

## Tracker (`src/analytics.js`)

Fire-and-forget: `track(event, props)` is synchronous, never throws, never awaits in UI
paths. Events queue and flush in batches (2 s timer, 20 rows, or `pagehide` via keepalive
fetch) into `public.events` with the public anon/publishable key.

No-ops when Supabase env is missing, when `VITE_ANALYTICS_ENABLED` is `false`/`0`/`off`
(default: on), under vitest, or on localhost unless the flag is explicitly `true`.
If the table is missing it stops for the rest of the page load (fail soft).

Events: `page_view`, `story_click`, `story_start`, `scene_view`, `choice`,
`story_complete`, `ad_shown`, `review_submitted`, `signup`, `outbound_click`.

Privacy: `session_id` is a random id in localStorage. Referrer host + UTM are captured on the
first `page_view` of a tab session. The player name is sent only on `story_start`, as a
trimmed, lowercased first name (≤ 24 chars), for the top-names aggregate.

## Schema (staff, once per project)

```bash
npm run schema:events
# fallback: Supabase Dashboard → SQL Editor → scripts/apply-events-schema.sql
```

RLS: anon + authenticated may INSERT only (column grants exclude `id`/`created_at`);
no select/update/delete. Check constraints cap every text field and `meta` (≤ 1 KB object).
The project secret key cannot run DDL over REST; `npm run schema:events` also accepts an
optional `SUPABASE_ACCESS_TOKEN` (personal access token) in `.env.local` for the Management API.

## Daily brief

```bash
npm run brief          # plain text to stdout
npm run brief -- --html
```

Reads with `SUPABASE_SECRET_KEY` from `.env.local`; writes
`/workspace/romance-forge-brief/brief-YYYY-MM-DD.{txt,html}` + `latest.*`
(override with `BRIEF_OUT_DIR`). It sends nothing.
