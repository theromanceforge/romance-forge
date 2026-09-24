-- Phase 2: public.saves + RLS (Quiet Breaks cloud progress)
-- Apply in Supabase SQL Editor if scripts/apply-saves-schema.mjs cannot reach DDL.

create table if not exists public.saves (
  user_id uuid not null references auth.users (id) on delete cascade,
  story_slug text not null,
  scene_id text not null,
  path jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, story_slug)
);

alter table public.saves enable row level security;

do $$ begin
  create policy "saves_select_own"
    on public.saves for select
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "saves_insert_own"
    on public.saves for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "saves_update_own"
    on public.saves for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "saves_delete_own"
    on public.saves for delete
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;
