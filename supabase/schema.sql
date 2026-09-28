-- Run once in Supabase SQL Editor. The public browser key is safe only with RLS enabled.
create table if not exists public.decks (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null check(jsonb_typeof(data)='object'), updated_at timestamptz not null default now()
);
create table if not exists public.plays (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null check(jsonb_typeof(data)='object'), updated_at timestamptz not null default now()
);
create table if not exists public.campaigns (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null check(jsonb_typeof(data)='object'), updated_at timestamptz not null default now()
);
create table if not exists public.collections (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null default '[]'::jsonb check(jsonb_typeof(data)='array'), updated_at timestamptz not null default now()
);
alter table public.decks enable row level security;
alter table public.plays enable row level security;
alter table public.campaigns enable row level security;
alter table public.collections enable row level security;
create policy "Own decks" on public.decks for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Own plays" on public.plays for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Own campaigns" on public.campaigns for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Own collection" on public.collections for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create index if not exists decks_user_idx on public.decks(user_id);
create index if not exists plays_user_idx on public.plays(user_id);
create index if not exists campaigns_user_idx on public.campaigns(user_id);
grant select,insert,update,delete on public.decks,public.plays,public.campaigns,public.collections to authenticated;
revoke all on public.decks,public.plays,public.campaigns,public.collections from anon;
