-- Run this in the Supabase SQL editor (Project > SQL Editor > New query).

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  color text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

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

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  month_id uuid references months(id) on delete cascade not null,
  date date not null,
  description text not null,
  amount numeric not null, -- negative = expense, positive = income
  category_id uuid references categories(id) on delete set null,
  type tx_type not null default 'personal',
  source_hash text not null, -- hash(date+description+amount), used to de-dupe re-imports
  raw_row jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (month_id, source_hash)
);

alter table categories enable row level security;
alter table months enable row level security;
alter table transactions enable row level security;

drop policy if exists "own rows" on categories;
drop policy if exists "own rows" on months;
drop policy if exists "own rows" on transactions;

create policy "own rows" on categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on months
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- RLS policies only control *which rows* a role can see/touch — Postgres also
-- requires a table-level grant before the role can touch the table at all.
-- Without this, every query fails with "permission denied for table X".
grant usage on schema public to authenticated;
grant select, insert, update, delete on categories, months, transactions to authenticated;
