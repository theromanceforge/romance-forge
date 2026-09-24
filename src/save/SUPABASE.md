# Cloud save (Supabase) — Phase 2 live wiring

See **[docs/phase2-supabase.md](../../docs/phase2-supabase.md)** for `saves` columns, RLS (`auth.uid() = user_id`), and env names.

- Browser: `src/auth/supabaseClient.js` creates a client only when `VITE_SUPABASE_URL` + anon/publishable are set.
- Adapter: `createSupabaseSaveStore(client)` in `src/save/supabaseStore.js`.
- Guest local saves still work without env or login.
- Server/admin secret keys belong only in `.env.local` and `scripts/` — never in Vite-bundled `src/` modules.
