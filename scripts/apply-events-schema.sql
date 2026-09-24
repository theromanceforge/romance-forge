-- First-party analytics: public.events (insert-only for anon/authenticated).
-- Apply with `npm run schema:events`, or paste into Supabase Dashboard → SQL Editor.
-- No PII: session_id is a random browser id; player_name is a trimmed, lowercased
-- first name (<= 24 chars) recorded only on story_start for the top-names aggregate.
-- Reads happen server-side only (secret key bypasses RLS) via scripts/daily-brief.mjs.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id text not null check (session_id ~ '^[A-Za-z0-9_-]{8,64}$'),
  event text not null check (event in (
    'page_view', 'story_click', 'story_start', 'scene_view', 'choice',
    'story_complete', 'ad_shown', 'review_submitted', 'signup', 'outbound_click'
  )),
  story_id text check (story_id is null or story_id ~ '^[a-z0-9-]{1,64}$'),
  spice text check (spice is null or spice in ('warm', 'hot')),
  layer smallint check (layer is null or (layer >= 0 and layer <= 20)),
  scene_id text check (scene_id is null or char_length(scene_id) <= 64),
  path text check (path is null or char_length(path) <= 200),
  referrer_host text check (referrer_host is null or char_length(referrer_host) <= 120),
  utm_source text check (utm_source is null or char_length(utm_source) <= 100),
  utm_medium text check (utm_medium is null or char_length(utm_medium) <= 100),
  utm_campaign text check (utm_campaign is null or char_length(utm_campaign) <= 100),
  player_name text check (
    player_name is null
    or (event = 'story_start' and char_length(player_name) between 1 and 24)
  ),
  meta jsonb not null default '{}'::jsonb check (
    jsonb_typeof(meta) = 'object' and pg_column_size(meta) <= 1024
  )
);

create index if not exists events_created_at_idx on public.events (created_at);
create index if not exists events_event_created_at_idx on public.events (event, created_at);

alter table public.events enable row level security;

-- Column-level grants: public roles can INSERT only, and cannot set id/created_at
-- (no backdating). No SELECT/UPDATE/DELETE grants or policies for anon/authenticated.
revoke all on table public.events from anon, authenticated;
grant insert (
  session_id, event, story_id, spice, layer, scene_id, path, referrer_host,
  utm_source, utm_medium, utm_campaign, player_name, meta
) on table public.events to anon, authenticated;
grant all on table public.events to service_role;

do $$ begin
  create policy "events_insert_public"
    on public.events for insert
    to anon, authenticated
    with check (true);
exception when duplicate_object then null;
end $$;

-- Make PostgREST pick up the new table immediately.
notify pgrst, 'reload schema';
