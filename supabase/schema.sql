-- Run this in the Supabase SQL editor (Project > SQL Editor > New query).
--
-- NOTE on `alter type tx_type add value`: Postgres refuses to run this
-- statement inside a transaction block, and pasting a whole multi-statement
-- script into one query often runs as one implicit transaction. If you get
-- "ALTER TYPE ... ADD VALUE cannot run inside a transaction block", run just
-- that one line by itself first, then run the rest of this file.

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- Never rendered anywhere in the UI — dropped rather than wired up.
alter table categories drop column if exists color;

-- Optional subcategory support: a category may have a parent category.
-- One level deep only (a subcategory's parent_id always points at a
-- top-level category) — enforced by the app, not the schema.
alter table categories add column if not exists parent_id uuid references categories(id) on delete cascade;

-- Manual drag-to-reorder within a group (top-level categories, or the
-- subcategories of one parent). New rows default to 0 and get pushed to the
-- end of their group at insert time by the app; pre-existing rows are all 0
-- until reordered, so category-tree.ts falls back to alphabetical for ties —
-- deliberately not backfilled here, since that would need to be a one-time
-- data migration and this file is meant to be safely re-run any number of
-- times.
alter table categories add column if not exists sort_order integer not null default 0;

create table if not exists months (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  year int not null,
  month int not null, -- 1-12
  created_at timestamptz not null default now(),
  unique (user_id, year, month)
);

do $$ begin
  create type tx_type as enum ('common', 'personal');
exception
  when duplicate_object then null;
end $$;

-- Third state: "undecided yet" — distinct from being uncategorized (no category_id).
alter type tx_type add value if not exists 'need_review';

do $$ begin
  create type card_type as enum ('regular', 'credit');
exception
  when duplicate_object then null;
end $$;

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  month_id uuid references months(id) on delete cascade not null,
  date date not null,
  description text not null, -- card title (from the "Spesifikasjon" column)
  location text, -- card subtitle (from the "Sted" column), if present
  notes text,
  amount numeric not null, -- negative = expense, positive = income
  category_id uuid references categories(id) on delete set null,
  type tx_type not null default 'personal',
  card_type card_type not null default 'credit',
  source_hash text not null, -- hash(date+description+amount), used to de-dupe re-imports
  raw_row jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (month_id, source_hash)
);

alter table transactions add column if not exists location text;
alter table transactions add column if not exists notes text;
alter table transactions add column if not exists card_type card_type not null default 'credit';

-- `add column if not exists` above is a no-op once the column already exists,
-- so this is what actually updates the default for databases that ran an
-- earlier version of this migration (default was 'regular').
alter table transactions alter column card_type set default 'credit';

-- A rule auto-categorizes future transactions matching its conditions on
-- upload (src/app/api/upload/route.ts). `conditions` is an array of
-- { field: "name" | "subtitle", operator, values: string[] } entries that
-- are AND'd together — the values within one entry are OR'd. A rule has at
-- most one entry per field+operator pair (src/lib/rule-merge.ts enforces
-- this on every write path instead of leaving duplicate entries/rules for
-- the same condition). See src/lib/apply-rules.ts for the matching engine
-- and src/lib/rule-description.ts for turning this into plain English.
create table if not exists rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  category_id uuid references categories(id) on delete cascade not null,
  conditions jsonb not null,
  created_at timestamptz not null default now()
);

-- `create table if not exists` above is a no-op if an earlier version of
-- this table (with `match_texts` instead of `conditions`) was already
-- created, so add the new column explicitly for that case too. Default
-- `[]` satisfies `not null` for any pre-existing rows.
alter table rules add column if not exists conditions jsonb not null default '[]'::jsonb;

-- Superseded by `conditions` above — drop if an earlier version of this
-- table was created.
alter table rules drop column if exists match_texts;

alter table categories enable row level security;
alter table months enable row level security;
alter table transactions enable row level security;
alter table rules enable row level security;

drop policy if exists "own rows" on categories;
drop policy if exists "own rows" on months;
drop policy if exists "own rows" on transactions;
drop policy if exists "own rows" on rules;

create policy "own rows" on categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on months
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- RLS policies only control *which rows* a role can see/touch — Postgres also
-- requires a table-level grant before the role can touch the table at all.
-- Without this, every query fails with "permission denied for table X".
grant usage on schema public to authenticated;
grant select, insert, update, delete on categories, months, transactions, rules to authenticated;
