create table if not exists lotr_users (
  id uuid primary key,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);
create table if not exists lotr_sessions (
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
