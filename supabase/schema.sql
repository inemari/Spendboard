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
  create type card_type as enum ('debit', 'credit');
exception
  when duplicate_object then null;
end $$;

-- Renames the pre-existing 'regular' label to 'debit' for databases created
-- before this rename. Existing rows keep their value (an enum rename-value
-- only relabels, it doesn't touch stored data), so this needs no backfill.
-- Swallows the error on re-run, whether because the label was already
-- renamed or the type was just created fresh above.
do $$ begin
  alter type card_type rename value 'regular' to 'debit';
exception
  when others then null;
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

-- Supports the overview's day/week/custom-range views, which query
-- transactions by date directly instead of by month_id.
create index if not exists transactions_user_id_date_idx on transactions (user_id, date);

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

-- Admin rule templates (src/app/admin/rules/, src/components/admin-rules-panel.tsx).
-- Global, not scoped to any one user — templates are named, reusable rule
-- bundles an admin curates, one of which can be marked `is_default` to mark
-- what a brand-new user should receive. `category_name` on each item (not a
-- category_id) is what makes a template portable across users, since every
-- user has their own distinct set of categories; applying a template
-- finds-or-creates a category by that name for whichever user it's applied
-- to (see `apply_rule_template` below).
--
-- IMPORTANT: replace the email literals in `is_admin()` with your own before
-- running this — every policy and RPC below gates on it.
create or replace function is_admin()
returns boolean
language sql
stable
as $$
  select auth.jwt() ->> 'email' in ('ine@live.no', 'inebredes1@gmail.com');
$$;

create table if not exists rule_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists rule_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references rule_templates(id) on delete cascade not null,
  category_name text not null,
  conditions jsonb not null,
  created_at timestamptz not null default now()
);

-- Only one template can be the default at a time — setting one clears any
-- other, rather than leaving the app to guess which of several to use.
create or replace function enforce_single_default_template()
returns trigger
language plpgsql
as $$
begin
  if new.is_default then
    update rule_templates set is_default = false where id <> new.id and is_default;
  end if;
  return new;
end;
$$;

drop trigger if exists only_one_default_template on rule_templates;
create trigger only_one_default_template
  before insert or update on rule_templates
  for each row
  when (new.is_default)
  execute function enforce_single_default_template();

alter table rule_templates enable row level security;
alter table rule_template_items enable row level security;

drop policy if exists "admin only" on rule_templates;
drop policy if exists "admin only" on rule_template_items;

create policy "admin only" on rule_templates
  for all using (is_admin()) with check (is_admin());

create policy "admin only" on rule_template_items
  for all using (is_admin()) with check (is_admin());

grant select, insert, update, delete on rule_templates, rule_template_items to authenticated;

-- Lets the admin page list users to apply a template to. auth.users isn't
-- exposed to the client directly, so this is the only way to read it —
-- security definer runs with the function owner's privileges, which is why
-- the is_admin() check inside matters (this would otherwise let any signed-
-- in user enumerate every account's email).
create or replace function list_app_users()
returns table (id uuid, email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;
  return query select au.id, au.email::text from auth.users au order by au.created_at;
end;
$$;

grant execute on function list_app_users() to authenticated;

-- Copies one template's items into `target_user_id`'s own categories/rules —
-- finding-or-creating a top-level category by name, then inserting a rule
-- pointing at it. security definer + the is_admin() check is what lets this
-- write rows owned by someone other than the caller; without it, RLS's
-- `auth.uid() = user_id` policy on categories/rules would block it outright,
-- as intended for every other write path in the app.
create or replace function apply_rule_template(p_template_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  cat_id uuid;
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  for item in
    select category_name, conditions from rule_template_items where template_id = p_template_id
  loop
    select id into cat_id
      from categories
      where user_id = target_user_id and parent_id is null and name = item.category_name
      limit 1;

    if cat_id is null then
      insert into categories (user_id, name)
        values (target_user_id, item.category_name)
        returning id into cat_id;
    end if;

    insert into rules (user_id, category_id, conditions)
      values (target_user_id, cat_id, item.conditions);
  end loop;
end;
$$;

grant execute on function apply_rule_template(uuid, uuid) to authenticated;

-- Seed: the starter pack described in CLAUDE.md's default-rules requirement
-- (Rema/Joker/Coop/Meny/Kiwi -> "Matbutikk"), marked as the default so it's
-- what `apply_rule_template` should be pointed at for a brand-new user until
-- an admin curates something else. Guarded so re-running this file doesn't
-- duplicate it.
do $$
declare
  new_template_id uuid;
begin
  if not exists (select 1 from rule_templates where name = 'Norwegian groceries starter pack') then
    insert into rule_templates (name, description, is_default)
      values (
        'Norwegian groceries starter pack',
        'Common Norwegian grocery chains, auto-categorized by name prefix.',
        true
      )
      returning id into new_template_id;

    insert into rule_template_items (template_id, category_name, conditions)
      values (
        new_template_id,
        'Matbutikk',
        jsonb_build_array(
          jsonb_build_object(
            'field', 'name',
            'operator', 'starts_with',
            'values', jsonb_build_array('Rema', 'Joker', 'Coop', 'Meny', 'Kiwi')
          )
        )
      );
  end if;
end $$;
