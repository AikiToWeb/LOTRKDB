create table if not exists lotr_users (
  id uuid primary key,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);
alter table lotr_users add column if not exists username text;
alter table lotr_users add column if not exists display_name text;
alter table lotr_users alter column email drop not null;
-- Preserve existing UUIDs, password hashes and saved documents.
update lotr_users set username=lower(email) where username is null;
update lotr_users set display_name=left(split_part(email,'@',1),30) where display_name is null;
alter table lotr_users alter column username set not null;
alter table lotr_users alter column display_name set not null;
create unique index if not exists lotr_users_username_idx on lotr_users(lower(username));
create table if not exists lotr_sessions (
  -- Sessions retain the original user UUID during the username migration.
  token_hash text primary key,
  user_id uuid not null references lotr_users(id) on delete cascade,
  expires_at timestamptz not null
);
create index if not exists lotr_sessions_user_idx on lotr_sessions(user_id);
create table if not exists lotr_documents (
  user_id uuid not null references lotr_users(id) on delete cascade,
  kind text not null check (kind in ('decks','plays','campaigns','owned')),
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, id)
);
create table if not exists lotr_catalog (
  id text primary key,
  data jsonb not null,
  content_hash text not null,
  updated_at timestamptz not null default now()
);
create table if not exists lotr_rooms (
  id uuid primary key,
  code text not null unique,
  host_id uuid not null references lotr_users(id) on delete cascade,
  name text not null,
  scenario_id text not null,
  max_players integer not null check (max_players between 1 and 4),
  status text not null default 'waiting' check (status in ('waiting','playing','finished','closed')),
  created_at timestamptz not null default now()
);
create table if not exists lotr_room_members (
  room_id uuid not null references lotr_rooms(id) on delete cascade,
  user_id uuid not null references lotr_users(id) on delete cascade,
  nickname text not null,
  deck jsonb,
  ready boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (room_id,user_id)
);
create index if not exists lotr_room_members_user_idx on lotr_room_members(user_id);
