-- Phase 4: public.reviews + RLS (signed-in reviews; auto-approve + CS hide)
-- Apply in Supabase SQL Editor if scripts/apply-reviews-schema.mjs cannot reach DDL.
-- Guest reviews stay localStorage-only and never land in this table.

create table if not exists public.reviews (
  user_id uuid not null references auth.users (id) on delete cascade,
  story_slug text not null,
  stars integer not null check (stars >= 1 and stars <= 5),
  body text not null default '' check (char_length(body) <= 280),
  display_name text not null default 'Reader',
  spice text not null check (spice in ('warm', 'hot')),
  approved boolean not null default true,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, story_slug)
);

alter table public.reviews enable row level security;

-- Public social proof: approved and not hidden
do $$ begin
  create policy "reviews_select_public"
    on public.reviews for select
    using (
      (approved = true and hidden = false)
      or (auth.uid() = user_id)
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "reviews_insert_own"
    on public.reviews for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "reviews_update_own"
    on public.reviews for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "reviews_delete_own"
    on public.reviews for delete
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;
