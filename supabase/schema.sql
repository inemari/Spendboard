-- Run this in the Supabase SQL editor (Project > SQL Editor > New query).
--
-- NOTE on `alter type tx_type add value`: Postgres refuses to run this
-- statement inside a transaction block, and pasting a whole multi-statement
-- script into one query often runs as one implicit transaction. If you get
-- "ALTER TYPE ... ADD VALUE cannot run inside a transaction block", run just
-- that one line by itself first, then run the rest of this file.

-- `gen_random_bytes` (used by create_household_invite() below to generate
-- invite codes) isn't a Postgres built-in — unlike gen_random_uuid(), it
-- needs pgcrypto. Without this, household pairing fails outright the moment
-- anyone tries to invite a partner ("function gen_random_bytes(integer)
-- does not exist"), confirmed live against this project.
create extension if not exists pgcrypto;

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

-- The icon a category wears in the overview's "Where it went" sidebar. Stores
-- one of our own stable slugs (see src/lib/category-icons.ts), never a lucide
-- export name, so upgrading the icon package can't invalidate saved rows.
-- Nullable: a category with no icon renders one guessed from its name, so
-- rows created before this column existed still look right with no backfill.
alter table categories add column if not exists icon text;

-- Manual drag-to-reorder within a group (top-level categories, or the
-- subcategories of one parent). New rows default to 0 and get pushed to the
-- end of their group at insert time by the app; pre-existing rows are all 0
-- until reordered, so category-tree.ts falls back to alphabetical for ties —
-- deliberately not backfilled here, since that would need to be a one-time
-- data migration and this file is meant to be safely re-run any number of
-- times.
alter table categories add column if not exists sort_order integer not null default 0;

-- Guards against duplicate categories under the same parent (including two
-- concurrent requests both seeding a brand-new account's default set at
-- once — see ensure-default-categories.ts — which without this could each
-- see zero existing categories and independently insert the full default
-- list, producing N copies of every default category). `coalesce` folds
-- every top-level category's null parent_id onto one sentinel value so
-- NULL actually collides with NULL here, unlike a plain unique index (where
-- every NULL is treated as distinct). Keyed on `lower(trim(name))`, not the
-- raw column, so "Groceries", "groceries", and " Groceries " are treated as
-- the same name — matching how rule-template category lookup already
-- normalizes names (see `apply_rule_template`/`apply_default_rule_template`
-- below). A plain `name` index let those variants coexist as visually
-- indistinguishable duplicate categories.
drop index if exists categories_user_parent_name_key;
create unique index if not exists categories_user_parent_name_key
  on categories (user_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(trim(name)));

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
  -- Derived from this row's own `date` at upload time, so a statement spanning
  -- a month boundary splits across two months rows. Scopes the dedup key
  -- below; reads always scope by `date`, never through here.
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

-- Supports every transaction read — month, day, week and custom-range views
-- all query by date rather than by month_id.
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

-- Names the item's parent category, one level deep (same shape as
-- categories.parent_id) — null means "top-level category". Needed because
-- category_name alone can't distinguish a subcategory from a top-level
-- category of the same name, and apply_rule_template/apply_default_rule_template
-- below must resolve/create the correct parent, not just any category with
-- that name.
alter table rule_template_items add column if not exists category_parent_name text;

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
-- finding-or-creating the item's category by name (and, if the item names a
-- parent, finding-or-creating that parent first and nesting under it), then
-- inserting a rule pointing at it. Name matching is case/whitespace-
-- insensitive (lower(trim(...))) so e.g. "Matbutikk" and "matbutikk " reuse
-- the same category instead of creating a visual duplicate. security
-- definer + the is_admin() check is what lets this write rows owned by
-- someone other than the caller; without it, RLS's `auth.uid() = user_id`
-- policy on categories/rules would block it outright, as intended for every
-- other write path in the app. Idempotent per rule: skips the insert when a
-- rule with the same user_id/category_id/conditions already exists, so
-- re-applying the same template twice doesn't create duplicate rules.
create or replace function apply_rule_template(p_template_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  resolved_parent_id uuid;
  cat_id uuid;
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  for item in
    select category_name, category_parent_name, conditions
    from rule_template_items where template_id = p_template_id
  loop
    resolved_parent_id := null;

    if item.category_parent_name is not null then
      select id into resolved_parent_id
        from categories
        where user_id = target_user_id
          and parent_id is null
          and lower(trim(name)) = lower(trim(item.category_parent_name))
        limit 1;

      if resolved_parent_id is null then
        insert into categories (user_id, name)
          values (target_user_id, item.category_parent_name)
          returning id into resolved_parent_id;
      end if;
    end if;

    select id into cat_id
      from categories
      where user_id = target_user_id
        and parent_id is not distinct from resolved_parent_id
        and lower(trim(name)) = lower(trim(item.category_name))
      limit 1;

    if cat_id is null then
      insert into categories (user_id, parent_id, name)
        values (target_user_id, resolved_parent_id, item.category_name)
        returning id into cat_id;
    end if;

    if not exists (
      select 1 from rules
      where user_id = target_user_id
        and category_id = cat_id
        and conditions = item.conditions
    ) then
      insert into rules (user_id, category_id, conditions)
        values (target_user_id, cat_id, item.conditions);
    end if;
  end loop;
end;
$$;

grant execute on function apply_rule_template(uuid, uuid) to authenticated;

-- Pushes default_categories entries the target user doesn't already have,
-- by name, without touching anything they do have — the non-destructive
-- counterpart to that user's own "Reset to Defaults" (which deletes
-- everything first). Lets an admin who fixes or adds a default category
-- back-fill it onto existing accounts instead of asking each user to
-- destructively reset. Same shape as ensure-default-categories.ts's seed
-- (parents first, so a subcategory's parent_id can be remapped from the
-- seed row's id to the id it was cloned into for this user), but every
-- insert is conditional on "this user has no category by this name in this
-- position" rather than assuming a brand-new, empty account. Matching is
-- case/whitespace-insensitive (lower(trim(...))), same as
-- categories_user_parent_name_key and apply_rule_template. Returns the
-- number of categories actually inserted.
create or replace function admin_sync_default_categories(target_user_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  parent record;
  child record;
  resolved_parent_id uuid;
  cat_id uuid;
  inserted_count int := 0;
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  for parent in
    select id, name, icon, sort_order from default_categories where parent_id is null order by sort_order
  loop
    select id into resolved_parent_id
      from categories
      where user_id = target_user_id
        and parent_id is null
        and lower(trim(name)) = lower(trim(parent.name))
      limit 1;

    if resolved_parent_id is null then
      insert into categories (user_id, name, icon, is_default, sort_order)
        values (target_user_id, parent.name, parent.icon, true, parent.sort_order)
        returning id into resolved_parent_id;
      inserted_count := inserted_count + 1;
    end if;

    for child in
      select name, icon, sort_order from default_categories
        where parent_id = parent.id order by sort_order
    loop
      select id into cat_id
        from categories
        where user_id = target_user_id
          and parent_id = resolved_parent_id
          and lower(trim(name)) = lower(trim(child.name))
        limit 1;

      if cat_id is null then
        insert into categories (user_id, parent_id, name, icon, is_default, sort_order)
          values (target_user_id, resolved_parent_id, child.name, child.icon, true, child.sort_order);
        inserted_count := inserted_count + 1;
      end if;
    end loop;
  end loop;

  return inserted_count;
end;
$$;

grant execute on function admin_sync_default_categories(uuid) to authenticated;

-- Self-service counterpart to apply_rule_template above, used by the Rules
-- page's "Reset to defaults" action (src/components/rules-manager-panel.tsx).
-- Unlike that function, this needs no is_admin() check — it only ever
-- reads/writes auth.uid()'s own rows, the same thing RLS's
-- `auth.uid() = user_id` policy on categories/rules already lets a user do
-- directly. It's security definer purely to read rule_templates/
-- rule_template_items, which carry an "admin only" RLS policy otherwise.
-- No-ops (returns 0) if no template is currently marked is_default.
create or replace function apply_default_rule_template()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  resolved_parent_id uuid;
  cat_id uuid;
  default_template_id uuid;
  uid uuid := auth.uid();
  inserted_count int := 0;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select id into default_template_id from rule_templates where is_default limit 1;
  if default_template_id is null then
    return 0;
  end if;

  for item in
    select category_name, category_parent_name, conditions
    from rule_template_items where template_id = default_template_id
  loop
    resolved_parent_id := null;

    if item.category_parent_name is not null then
      select id into resolved_parent_id
        from categories
        where user_id = uid
          and parent_id is null
          and lower(trim(name)) = lower(trim(item.category_parent_name))
        limit 1;

      if resolved_parent_id is null then
        insert into categories (user_id, name)
          values (uid, item.category_parent_name)
          returning id into resolved_parent_id;
      end if;
    end if;

    select id into cat_id
      from categories
      where user_id = uid
        and parent_id is not distinct from resolved_parent_id
        and lower(trim(name)) = lower(trim(item.category_name))
      limit 1;

    if cat_id is null then
      insert into categories (user_id, parent_id, name)
        values (uid, resolved_parent_id, item.category_name)
        returning id into cat_id;
    end if;

    if not exists (
      select 1 from rules
      where user_id = uid
        and category_id = cat_id
        and conditions = item.conditions
    ) then
      insert into rules (user_id, category_id, conditions)
        values (uid, cat_id, item.conditions);
      inserted_count := inserted_count + 1;
    end if;
  end loop;

  return inserted_count;
end;
$$;

grant execute on function apply_default_rule_template() to authenticated;

-- Shared credit-card settlement (see CLAUDE.md's "Shared Credit Card
-- Settlement" section). V1 scope: exactly two members per household,
-- self-serve pairing by invite code (there's no self-serve signup, but
-- this pairs two *existing* accounts, which is a smaller ask than that).
--
-- Privacy shape: every table here except `credit_invoices` and
-- `settlements` is either fully private (no cross-user select at all) or
-- reachable only through a SECURITY DEFINER RPC that deliberately returns
-- less than the full row — the same pattern `list_app_users`/
-- `apply_rule_template` already establish above. Nothing here ever lets one
-- member's client query the other member's `transactions` rows directly;
-- transactions keep their existing `auth.uid() = user_id` policy untouched.

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- unique(user_id): a user belongs to at most one household at a time — V1's
-- "two household members" scope, not a general multi-household model.
create table if not exists household_members (
  household_id uuid references households(id) on delete cascade not null,
  user_id uuid references auth.users not null,
  default_contribution numeric not null default 0,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (user_id)
);

-- Self-serve pairing: the inviter shares `code` out-of-band (no email
-- lookup needed against auth.users), the invitee redeems it from their own
-- account. Both creation and redemption go through RPCs below rather than
-- direct table access, so the "at most 2 members" invariant and the
-- not-already-in-a-household check are enforced in one place.
create table if not exists household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade not null,
  invited_by uuid references auth.users not null,
  code text unique not null,
  status text not null default 'pending', -- pending | accepted | revoked
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

-- A credit-card billing period, distinct from `month_id` (see ROADMAP.md's
-- "Credit-card invoices, distinct from the calendar month") — shared at the
-- household level so both members can file transactions under the same
-- named period ("August 2026") even though a card's billing window rarely
-- lines up with calendar months. Chosen per-file at upload time.
create table if not exists credit_invoices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade not null,
  label text not null,
  created_at timestamptz not null default now()
);

-- Nullable: a transaction has no invoice until the uploader picks one (and
-- solo users with no household never see the picker at all — see
-- upload-button.tsx). on delete set null, not cascade: deleting an invoice
-- (there's no UI for this in V1) must not take transactions with it.
alter table transactions add column if not exists credit_invoice_id uuid references credit_invoices(id) on delete set null;

-- One row per invoice. Unlike the original version of this table, a row can
-- now exist before completion: `mark_settlement_paid` below creates one
-- (`status = 'open'`) the first time *either* member marks their own
-- transfer paid, so per-member payment state (settlement_members below) has
-- somewhere to live while the household is still mid-settlement. `status`
-- only ever flips open -> completed, once, when every household member's
-- settlement_members row shows `payment_status = 'paid'` — at that instant
-- `common_total`/`common_share` are filled in and frozen here for good.
-- Nothing in an already-`completed` row is ever updated again, so later
-- edits to the underlying transactions can't retroactively change a
-- completed settlement.
create table if not exists settlements (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references credit_invoices(id) not null unique,
  common_total numeric not null,
  common_share numeric not null,
  per_member jsonb not null,
  completed_by uuid references auth.users not null,
  completed_at timestamptz not null default now()
);

-- Existing rows only ever came from the old one-shot `complete_settlement`
-- flow, i.e. they were always fully completed — hence the 'completed'
-- default, so this backfill doesn't relabel real history as still-open.
-- Rows created by the new `mark_settlement_paid` flow pass `status = 'open'`
-- explicitly on insert and only this function ever flips them to
-- 'completed', so the column default here is purely about pre-existing data.
alter table settlements add column if not exists status text not null default 'completed'
  check (status in ('open', 'completed'));
alter table settlements
  alter column common_total drop not null,
  alter column common_share drop not null,
  alter column completed_by drop not null,
  alter column completed_at drop not null,
  alter column completed_at drop default;

-- Independent per-member payment state, replacing what used to be baked
-- into `settlements.per_member` only at the moment of full completion.
-- `payment_status`/`paid_at` are mutable while the settlement is still
-- `open` (either member can mark themselves paid or undo it via
-- `mark_settlement_paid`/`unmark_settlement_paid`); `personal_total`/
-- `common_share`/`transfer_total` stay null until the *whole* settlement
-- completes, at which point they're written once, together, from one live
-- computation (see `mark_settlement_paid`) and never touched again — this
-- is what keeps a completed settlement a true frozen snapshot even though
-- one member may have marked paid well before the other did.
create table if not exists settlement_members (
  settlement_id uuid references settlements(id) on delete cascade not null,
  user_id uuid references auth.users not null,
  payment_status text not null default 'to_pay' check (payment_status in ('to_pay', 'paid')),
  paid_at timestamptz,
  contribution numeric,
  personal_total numeric,
  common_share numeric,
  transfer_total numeric,
  primary key (settlement_id, user_id)
);

-- One-time migration of any already-completed settlements' `per_member`
-- jsonb into the new relational shape above, guarded so re-running this
-- file doesn't duplicate rows. Old shape per element: {user_id,
-- personal_total, common_total (was actually this member's *share*,
-- despite the name), contribution, amount_due (the final transfer figure)}.
do $$
declare
  s record;
  m jsonb;
begin
  for s in select id, per_member, completed_at from settlements where per_member is not null loop
    for m in select value from jsonb_array_elements(s.per_member) as t(value) loop
      insert into settlement_members (
        settlement_id, user_id, payment_status, paid_at, contribution,
        personal_total, common_share, transfer_total
      ) values (
        s.id,
        (m->>'user_id')::uuid,
        'paid',
        s.completed_at,
        (m->>'contribution')::numeric,
        (m->>'personal_total')::numeric,
        (m->>'common_total')::numeric,
        (m->>'amount_due')::numeric
      )
      on conflict (settlement_id, user_id) do nothing;
    end loop;
  end loop;
end $$;

-- Nothing reads per_member anymore now that settlement_members exists.
alter table settlements drop column if exists per_member;

alter table households enable row level security;
alter table household_members enable row level security;
alter table household_invites enable row level security;
alter table credit_invoices enable row level security;
alter table settlements enable row level security;
alter table settlement_members enable row level security;

-- SECURITY DEFINER so it can check membership without itself being blocked
-- by the RLS it's used inside of — the same reason is_admin() above needs
-- no SECURITY DEFINER (it doesn't query a protected table) while this does.
create or replace function is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from household_members
    where household_id = target_household_id and user_id = auth.uid()
  );
$$;

drop policy if exists "members can view" on households;
create policy "members can view" on households
  for select using (is_household_member(id));

drop policy if exists "members can view" on household_members;
create policy "members can view" on household_members
  for select using (is_household_member(household_id));

-- Invites are visible to the inviter (to show a pending code) and to every
-- existing member of the household being invited into — never to anyone
-- else, since `code` alone must not be select-able by an uninvolved user.
drop policy if exists "involved parties can view" on household_invites;
create policy "involved parties can view" on household_invites
  for select using (invited_by = auth.uid() or is_household_member(household_id));

drop policy if exists "members can manage" on credit_invoices;
create policy "members can manage" on credit_invoices
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));

drop policy if exists "members can view" on settlements;
create policy "members can view" on settlements
  for select using (is_household_member((select household_id from credit_invoices where id = invoice_id)));

-- Both members' rows are visible to each other here (not just the caller's
-- own) — that's intentional: once a settlement exists, seeing your
-- partner's payment status (and, once completed, their frozen personal/
-- common/transfer figures) is exactly what the settlement screen needs to
-- show, and is the one place the request's privacy rules explicitly allow
-- exposing another member's Personal *total* (never their transaction
-- rows). No insert/update/delete policy: every write goes through
-- `mark_settlement_paid`/`unmark_settlement_paid` (SECURITY DEFINER).
drop policy if exists "members can view" on settlement_members;
create policy "members can view" on settlement_members
  for select using (is_household_member((
    select ci.household_id
    from settlements s
    join credit_invoices ci on ci.id = s.invoice_id
    where s.id = settlement_members.settlement_id
  )));

grant usage on schema public to authenticated;
grant select on households, household_members, household_invites to authenticated;
grant select, insert, update, delete on credit_invoices to authenticated;
grant select on settlements to authenticated;
grant select on settlement_members to authenticated;

-- Every other write path here (creating/joining a household, setting your
-- own contribution default, marking a settlement paid) goes through one of
-- the RPCs below instead of a table policy — each enforces an invariant
-- (at most 2 members, no double-join, need-review must be clear) that a
-- plain row-level policy can't express.

create or replace function create_household()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
begin
  if exists (select 1 from household_members where user_id = auth.uid()) then
    raise exception 'You already belong to a household.';
  end if;

  insert into households default values returning id into new_household_id;
  insert into household_members (household_id, user_id) values (new_household_id, auth.uid());
  return new_household_id;
end;
$$;

grant execute on function create_household() to authenticated;

-- `search_path` includes `extensions` because Supabase installs pgcrypto
-- there by default, not into `public` — `gen_random_bytes` below is
-- unresolvable under `search_path = public` alone even once the extension
-- is enabled, confirmed live against this project ("function
-- gen_random_bytes(integer) does not exist" persisted even after `create
-- extension if not exists pgcrypto` ran, because the extension was already
-- installed in `extensions`, just not on this function's search path).
create or replace function create_household_invite()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  caller_household_id uuid;
  member_count int;
  new_code text;
begin
  select household_id into caller_household_id
    from household_members where user_id = auth.uid();

  if caller_household_id is null then
    raise exception 'You must belong to a household to invite someone.';
  end if;

  select count(*) into member_count from household_members where household_id = caller_household_id;
  if member_count >= 2 then
    raise exception 'This household already has two members.';
  end if;

  update household_invites set status = 'revoked'
    where household_id = caller_household_id and status = 'pending';

  new_code := encode(gen_random_bytes(6), 'base64');
  insert into household_invites (household_id, invited_by, code)
    values (caller_household_id, auth.uid(), new_code);
  return new_code;
end;
$$;

grant execute on function create_household_invite() to authenticated;

create or replace function redeem_household_invite(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  invite record;
  member_count int;
begin
  if exists (select 1 from household_members where user_id = auth.uid()) then
    raise exception 'You already belong to a household.';
  end if;

  select * into invite from household_invites
    where code = p_code and status = 'pending' and expires_at > now();

  if invite is null then
    raise exception 'That invite code is invalid or has expired.';
  end if;

  select count(*) into member_count from household_members where household_id = invite.household_id;
  if member_count >= 2 then
    raise exception 'This household already has two members.';
  end if;

  insert into household_members (household_id, user_id) values (invite.household_id, auth.uid());
  update household_invites set status = 'accepted' where id = invite.id;
end;
$$;

grant execute on function redeem_household_invite(text) to authenticated;

create or replace function set_default_contribution(p_amount numeric)
returns void
language sql
security definer
set search_path = public
as $$
  update household_members set default_contribution = p_amount where user_id = auth.uid();
$$;

grant execute on function set_default_contribution(numeric) to authenticated;

-- Live per-member totals for one invoice — the one place a member ever
-- learns anything about their partner's spending. `personal_total` is
-- shown for both members (the request's own privacy rules explicitly allow
-- exposing a partner's Personal *total*, just never their transaction
-- list — and it's recoverable anyway from transfer_total - common_share
-- once a settlement exists, so masking it here bought nothing). Amounts are
-- normalized the same way src/lib/overview.ts does: expenses (negative
-- amounts) are summed as positive spend magnitude; income/refunds are
-- excluded, not netted in.
--
-- IMPORTANT: every OUT column above is also a bare identifier available to
-- the function body below (RETURNS TABLE creates PL/pgSQL variables from
-- its column names) — a past version of this function referenced a bare
-- `user_id` in a WHERE clause and it silently collided with the `user_id`
-- OUT column, throwing "column reference is ambiguous" on every call.
-- Always qualify every column reference in here with its source alias.
create or replace function household_invoice_summary(p_invoice_id uuid)
returns table (
  user_id uuid,
  is_self boolean,
  personal_total numeric,
  common_total numeric,
  need_review_count int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  caller_household_id uuid;
  target_household_id uuid;
begin
  select ci.household_id into target_household_id from credit_invoices ci where ci.id = p_invoice_id;
  select hm.household_id into caller_household_id from household_members hm where hm.user_id = auth.uid();

  if target_household_id is null or target_household_id is distinct from caller_household_id then
    raise exception 'Not authorized.';
  end if;

  return query
    select
      hm.user_id,
      hm.user_id = auth.uid() as is_self,
      coalesce(sum(case when t.type = 'personal' and t.amount < 0 then -t.amount else 0 end), 0) as personal_total,
      coalesce(sum(case when t.type = 'common' and t.amount < 0 then -t.amount else 0 end), 0) as common_total,
      count(*) filter (where t.type = 'need_review')::int as need_review_count
    from household_members hm
    left join transactions t on t.user_id = hm.user_id and t.credit_invoice_id = p_invoice_id
    where hm.household_id = target_household_id
    group by hm.user_id;
end;
$$;

grant execute on function household_invoice_summary(uuid) to authenticated;

-- Marks the caller's own transfer paid for one invoice (upserting the
-- settlements header as 'open' the first time anyone in the household pays
-- toward it), blocking while either member still has a `need_review`
-- transaction on this invoice — same guard the old complete_settlement had,
-- just checked here instead of only at the very end. Re-callable: paying
-- again before the household fully completes updates the stored
-- contribution/paid_at rather than erroring, so a member can correct their
-- contribution amount up until the last member pays.
--
-- Once *every* household member's settlement_members row shows
-- payment_status = 'paid', this same call computes live totals for
-- everyone together, in one shot, and freezes them into settlement_members/
-- settlements — deliberately not per-member as each one pays, since the
-- household's common split only depends on *combined* totals and can't be
-- correctly finalized until nobody's data can still change it.
create or replace function mark_settlement_paid(p_invoice_id uuid, p_contribution numeric)
returns settlements
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_household_id uuid;
  target_household_id uuid;
  unresolved_count int;
  member_count int;
  paid_count int;
  target_settlement_id uuid;
  existing_status text;
  final_total_common numeric;
  final_common_share numeric;
  result settlements;
begin
  select ci.household_id into target_household_id from credit_invoices ci where ci.id = p_invoice_id;
  select hm.household_id into caller_household_id from household_members hm where hm.user_id = auth.uid();

  if target_household_id is null or target_household_id is distinct from caller_household_id then
    raise exception 'Not authorized.';
  end if;

  select s.id, s.status into target_settlement_id, existing_status from settlements s where s.invoice_id = p_invoice_id;

  if existing_status = 'completed' then
    raise exception 'This settlement has already been completed.';
  end if;

  select count(*) into unresolved_count
    from transactions t
    join household_members hm on hm.user_id = t.user_id
    where t.credit_invoice_id = p_invoice_id
      and hm.household_id = target_household_id
      and t.type = 'need_review';

  if unresolved_count > 0 then
    raise exception 'Cannot mark paid while any need-review transactions remain on this invoice.';
  end if;

  if target_settlement_id is null then
    insert into settlements (invoice_id, status) values (p_invoice_id, 'open')
      returning id into target_settlement_id;
  end if;

  insert into settlement_members (settlement_id, user_id, payment_status, paid_at, contribution)
    values (target_settlement_id, auth.uid(), 'paid', now(), p_contribution)
    on conflict (settlement_id, user_id) do update
      set payment_status = 'paid', paid_at = now(), contribution = p_contribution;

  select count(*) into member_count from household_members where household_id = target_household_id;
  select count(*) into paid_count
    from settlement_members
    where settlement_id = target_settlement_id and payment_status = 'paid';

  if paid_count >= member_count then
    -- Every member has now marked paid: compute live totals for the whole
    -- household exactly once, together, and freeze the result — not as
    -- each member pays, since the common split depends on *combined*
    -- totals and isn't final until nobody's data can still move it.
    select sum(per_member.common_total), sum(per_member.common_total) / count(*)
      into final_total_common, final_common_share
      from (
        select hm.user_id,
          coalesce(sum(case when t.type = 'common' and t.amount < 0 then -t.amount else 0 end), 0) as common_total
        from household_members hm
        left join transactions t on t.user_id = hm.user_id and t.credit_invoice_id = p_invoice_id
        where hm.household_id = target_household_id
        group by hm.user_id
      ) per_member;

    update settlement_members sm
      set personal_total = lt.personal_total,
          common_share = final_common_share,
          transfer_total = lt.personal_total + final_common_share - coalesce(sm.contribution, 0)
      from (
        select hm.user_id,
          coalesce(sum(case when t.type = 'personal' and t.amount < 0 then -t.amount else 0 end), 0) as personal_total
        from household_members hm
        left join transactions t on t.user_id = hm.user_id and t.credit_invoice_id = p_invoice_id
        where hm.household_id = target_household_id
        group by hm.user_id
      ) lt
      where sm.settlement_id = target_settlement_id and sm.user_id = lt.user_id;

    update settlements s
      set status = 'completed',
          common_total = final_total_common,
          common_share = final_common_share,
          completed_by = auth.uid(),
          completed_at = now()
      where s.id = target_settlement_id;
  end if;

  select * into result from settlements where id = target_settlement_id;
  return result;
end;
$$;

grant execute on function mark_settlement_paid(uuid, numeric) to authenticated;

-- Undoes a not-yet-completed "paid" mark for the caller's own transfer.
-- No-ops if no settlement row exists yet (nothing to undo); raises once the
-- settlement has fully completed, matching the "never edit a completed
-- settlement" invariant.
create or replace function unmark_settlement_paid(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_household_id uuid;
  target_household_id uuid;
  target_settlement_id uuid;
  existing_status text;
begin
  select ci.household_id into target_household_id from credit_invoices ci where ci.id = p_invoice_id;
  select hm.household_id into caller_household_id from household_members hm where hm.user_id = auth.uid();

  if target_household_id is null or target_household_id is distinct from caller_household_id then
    raise exception 'Not authorized.';
  end if;

  select s.id, s.status into target_settlement_id, existing_status from settlements s where s.invoice_id = p_invoice_id;

  if target_settlement_id is null then
    return;
  end if;

  if existing_status = 'completed' then
    raise exception 'This settlement has already been completed and can no longer be changed.';
  end if;

  update settlement_members
    set payment_status = 'to_pay', paid_at = null
    where settlement_id = target_settlement_id and user_id = auth.uid();
end;
$$;

grant execute on function unmark_settlement_paid(uuid) to authenticated;

-- The only way a partner's individual transaction rows are ever exposed:
-- hard-filtered to `type = 'common'` (Personal/need-review rows are never
-- returned, regardless of who asks), and only for a shared invoice. Returns
-- the target member's own category name/icon already resolved server-side
-- — a bare category_id would be useless to the caller, since RLS blocks
-- them from reading someone else's `categories` table to look it up.
create or replace function household_partner_common_transactions(p_invoice_id uuid, p_target_user_id uuid)
returns table (
  id uuid,
  date date,
  description text,
  location text,
  amount numeric,
  category_name text,
  category_icon text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  caller_household_id uuid;
  target_household_id uuid;
  member_household_id uuid;
begin
  select ci.household_id into target_household_id from credit_invoices ci where ci.id = p_invoice_id;
  select hm.household_id into caller_household_id from household_members hm where hm.user_id = auth.uid();
  select hm.household_id into member_household_id from household_members hm where hm.user_id = p_target_user_id;

  if target_household_id is null
     or target_household_id is distinct from caller_household_id
     or target_household_id is distinct from member_household_id then
    raise exception 'Not authorized.';
  end if;

  return query
    select t.id, t.date, t.description, t.location, t.amount, c.name, c.icon
    from transactions t
    left join categories c on c.id = t.category_id
    where t.user_id = p_target_user_id
      and t.credit_invoice_id = p_invoice_id
      and t.type = 'common'
    order by t.date desc;
end;
$$;

grant execute on function household_partner_common_transactions(uuid, uuid) to authenticated;

-- Lets the settlement screen show "you" vs. the partner's email — auth.users
-- isn't exposed to the client, and household_members has no email column of
-- its own (it only ever stores a user_id), so this is the only way to read
-- it. Same security-definer shape as list_app_users(), scoped to the
-- caller's own household instead of gated by is_admin().
-- Bare `user_id` below is qualified deliberately — this function's own
-- `returns table (user_id uuid, ...)` makes `user_id` a PL/pgSQL variable
-- for the rest of the body, and an earlier unqualified reference here threw
-- "column reference is ambiguous" on every call. See household_invoice_summary
-- above for the same gotcha in more detail.
create or replace function household_member_emails()
returns table (user_id uuid, email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_household_id uuid;
begin
  select hm.household_id into caller_household_id from household_members hm where hm.user_id = auth.uid();

  if caller_household_id is null then
    return;
  end if;

  return query
    select au.id, au.email::text
    from household_members hm
    join auth.users au on au.id = hm.user_id
    where hm.household_id = caller_household_id;
end;
$$;

grant execute on function household_member_emails() to authenticated;

-- Admin-managed seed list for `ensure-default-categories.ts` — replaces the
-- hardcoded array that used to live only in that file. Every authenticated
-- user needs read access (their own first page load is what seeds their
-- categories from this), but only an admin can curate it. Deleting a row
-- here is safe: it only changes what a *future* brand-new account gets
-- seeded with, never anything an existing user already has in their own
-- `categories` table — the two are decoupled the moment the seed runs.
create table if not exists default_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- One level deep only, same as `categories.parent_id` — a seeded
-- subcategory's parent_id always points at a top-level default category.
alter table default_categories add column if not exists parent_id uuid references default_categories(id) on delete cascade;

alter table default_categories enable row level security;

drop policy if exists "anyone can view" on default_categories;
create policy "anyone can view" on default_categories
  for select using (true);

drop policy if exists "admin can manage" on default_categories;
create policy "admin can manage" on default_categories
  for insert with check (is_admin());

drop policy if exists "admin can update" on default_categories;
create policy "admin can update" on default_categories
  for update using (is_admin()) with check (is_admin());

drop policy if exists "admin can delete" on default_categories;
create policy "admin can delete" on default_categories
  for delete using (is_admin());

grant select, insert, update, delete on default_categories to authenticated;

-- One-time migration of today's hardcoded list into the new table, guarded
-- so re-running this file doesn't duplicate it once any row exists.
do $$
begin
  if not exists (select 1 from default_categories) then
    insert into default_categories (name, icon, sort_order) values
      ('Groceries', 'shopping-cart', 0),
      ('Dining out', 'utensils', 1),
      ('Transport', 'car', 2),
      ('Housing', 'house', 3),
      ('Utilities', 'zap', 4),
      ('Shopping', 'shopping-bag', 5),
      ('Health', 'heart-pulse', 6),
      ('Entertainment', 'popcorn', 7),
      ('Subscriptions', 'repeat', 8),
      ('Other', 'shapes', 9);
  end if;
end $$;

-- Lists every household with its members' emails, for the admin households
-- page — same "auth.users isn't client-readable" reasoning as
-- household_member_emails() above, just admin-gated instead of scoped to
-- the caller's own household.
create or replace function admin_list_households()
returns table (household_id uuid, user_id uuid, email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  return query
    select hm.household_id, au.id, au.email::text
    from household_members hm
    join auth.users au on au.id = hm.user_id
    order by hm.household_id, au.created_at;
end;
$$;

grant execute on function admin_list_households() to authenticated;

-- Directly pairs two existing users into a new household, bypassing the
-- self-serve invite-code flow entirely (the admin already controls both
-- accounts' provisioning, so there's no need to exchange a code). Same
-- invariants as the self-serve path: neither user may already belong to a
-- household, and a household never grows past two members.
create or replace function admin_create_household(user_a uuid, user_b uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  if user_a = user_b then
    raise exception 'Choose two different users.';
  end if;

  if exists (select 1 from household_members where user_id in (user_a, user_b)) then
    raise exception 'One of these users already belongs to a household.';
  end if;

  insert into households default values returning id into new_household_id;
  insert into household_members (household_id, user_id) values
    (new_household_id, user_a),
    (new_household_id, user_b);

  return new_household_id;
end;
$$;

grant execute on function admin_create_household(uuid, uuid) to authenticated;

-- Removes one member from a household — "editing" a household is scoped to
-- this rather than dissolving one outright, so a household's
-- credit_invoices/settlements are never at risk of being orphaned by an
-- admin action. The household row (and anything filed under it) is left
-- untouched even if this empties it out entirely; admin_add_household_member
-- below is how the remaining member (if any) gets re-paired.
create or replace function admin_remove_household_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  delete from household_members where user_id = p_user_id;
end;
$$;

grant execute on function admin_remove_household_member(uuid) to authenticated;

-- Adds one user into an *existing* household — the counterpart to removal
-- above, for re-pairing a household left with only one member. Same
-- invariants as admin_create_household: the target user mustn't already
-- belong to a household, and a household never grows past two members.
create or replace function admin_add_household_member(p_household_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  member_count int;
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  if exists (select 1 from household_members where user_id = p_user_id) then
    raise exception 'This user already belongs to a household.';
  end if;

  select count(*) into member_count from household_members where household_id = p_household_id;
  if member_count >= 2 then
    raise exception 'This household already has two members.';
  end if;

  insert into household_members (household_id, user_id) values (p_household_id, p_user_id);
end;
$$;

grant execute on function admin_add_household_member(uuid, uuid) to authenticated;

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
