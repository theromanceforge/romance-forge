# Phase 2 — Supabase cloud (wired)

**Status:** client wiring is live when `VITE_SUPABASE_URL` + anon/publishable are set in `.env.local`. Guest local saves still work with no env and no login.

## Env

| Name | Purpose |
|------|---------|
| `VITE_SUPABASE_URL` | Project URL (Vite-bundled) |
| `VITE_SUPABASE_ANON_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key (Vite-bundled) |
| `SUPABASE_SECRET_KEY` | Secret — **scripts/admin only**, never `VITE_`, never import from `src/` |

## Table: `saves`

| Column | Type | Notes |
|--------|------|--------|
| `user_id` | `uuid` | FK to `auth.users`; matches `SaveRecord.userId` |
| `story_slug` | `text` | e.g. `until-the-quiet-breaks` |
| `scene_id` | `text` | current scene |
| `path` | `jsonb` | ordered scene id array |
| `updated_at` | `timestamptz` | last write |

Primary key: `(user_id, story_slug)`.

SQL + apply helper: `scripts/apply-saves-schema.sql` / `scripts/apply-saves-schema.mjs`.

## RLS

Players read/write **only** their rows (`auth.uid() = user_id`). See the SQL file for policies.

## App seams

- `src/auth/supabaseClient.js` — gated `createClient`
- `src/save/supabaseStore.js` — `createSupabaseSaveStore` + camelCase ↔ snake_case
- `src/auth/cloud.js` — sign in / sign up / handoff
- Guest path — `createLocalSaveStore` unchanged
- Mock demo — still available when cloud is down or for local demos

Prove: `node scripts/prove-cloud-save.mjs` (uses secret only in that script to create a throwaway user).

## Auth URLs (signup confirm)

Confirm emails use **Authentication → URL Configuration**:

1. **Site URL** — set to the live catalog host (not `http://localhost:5173`). Example: `https://frog-juan-ipaq-rats.trycloudflare.com/`
2. **Redirect URLs** — allowlist that same origin (and `https://…trycloudflare.com/**` if using wildcards).

The client passes `emailRedirectTo` from `location.origin` on signup. Ephemeral trycloudflare hosts change when the tunnel restarts — update Site URL / Redirect URLs when Publisher rotates the link.
