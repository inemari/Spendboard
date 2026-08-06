@AGENTS.md

# Spendboard

Spendboard turns a monthly bank statement into a categorized, at-a-glance view
of where your money went. Upload an Excel or CSV export, sort transactions by
drag-and-drop board, dropdown, or one-by-one review, and tag each as Common,
Personal, or Need review to track shared vs. personal spending side by side.
See [README.md](README.md) for setup and [DESIGN.md](DESIGN.md) for the
visual design system.

## Product requirements

### Must have (implemented)

- Upload an Excel/CSV bank statement for a given month; transactions are parsed,
  de-duplicated (by date+description+amount hash), and shown as cards.
- Each transaction card's **title is the `Spesifikasjon` (description) column**,
  and its **subtitle is the `Sted` (location) column**, when present.
- The month workspace (`/[year]/[month]`) is an **overview dashboard**
  (`transaction-board.tsx`): a hero "spent this month" figure, a common /
  personal / need-review split meter, a ranked "Where it went" category
  breakdown (`category-breakdown.tsx`, subcategory spend rolled into its
  parent, tail folded into "Other"), and a day-grouped, searchable transaction
  list (`transaction-list.tsx`) whose rows expand to reveal the full editor.
  A desktop-only **Overview / Board** toggle swaps the list for the
  drag-and-drop board. Spend-focused aggregates live in `src/lib/overview.ts`,
  deliberately separate from `totals.ts` (which nets income against expenses).
- **Month navigation**: prev/next arrows in `app-header.tsx` via
  `month-nav.tsx`. Any month is reachable; there is no "has data" check, so
  stepping into an empty month shows the empty state.
- Categorize transactions via dropdown, drag-and-drop board (desktop), or the
  one-by-one "Categorize" screen (drag a card onto its category).
- The board (`category-board.tsx`) is built for **10+ categories with 0–5
  subcategories each**: a sticky "Uncategorized" queue on the left you drag
  _from_, and a wrapping auto-fill grid of category tiles
  (`category-tile.tsx`) on the right — not a horizontal scroller, because you
  can't scroll sideways while holding a drag. Each tile carries a "General"
  drop slot plus one slot per subcategory; a filter box appears past 6
  categories. Board cards use `TransactionCard`'s `compact` variant, which
  drops the category/type/card-type/delete controls (that editor stays one
  click away in the overview list) but keeps the note field — notes have no
  other surface on the board, unlike those other controls.
- **Search/filter transactions** by description or location, plus All /
  Uncategorized / Need review filters, on the overview list.
- Optional one-level subcategories (e.g. "Hud/hår-pleie" → "Hår").
- Toggle each transaction between **Common**, **Personal**, and **Need review**
  (a third state for "haven't decided yet" — distinct from being uncategorized).
- Free-text **note** field per transaction.
- Per-transaction **card type**: Credit card vs. regular (debit) card.
- Custom category create/rename/delete.
- Per-category, per-month common/personal/overall totals; uncategorized count.
- Undo action on the toast shown whenever a transaction's category changes.
- Multi-select transaction cards (checkbox); dragging a selected card in the
  desktop board moves the whole selection, not just that card. A bulk action
  bar (bottom of screen) lets you set category / common-personal-need_review /
  card type across the whole selection at once.
- Categorizing a transaction with similarly-named uncategorized siblings opens
  a review dialog (name, subtitle, amount, date, current category per
  candidate — `src/components/similar-transactions-dialog.tsx`) letting the
  user pick which to move too, then optionally create a persistent
  categorization **rule** (`rules` table) via a follow-up confirm dialog
  (`src/components/create-rule-dialog.tsx`). Rules are listed/deletable on the
  `/[year]/[month]/rules` page and auto-applied to matching descriptions at
  upload time (`src/app/api/upload/route.ts`).
- Delete a transaction, single or bulk-selected, with a confirmation prompt
  (same `window.confirm` pattern as category deletion).
- The Rules page (`rules-manager-panel.tsx`) groups rules by their target
  category (parent categories before their subcategories, via
  `flattenWithDepth`), with rules targeting a deleted category collected into
  a trailing "Unknown category" group. A search box filters rules by matching
  against each rule's rendered description text (which already includes the
  category name), so searching a category name works without a separate
  filter control.
- **Re-apply rules retroactively.** Each rule card on the Rules page has an
  "apply to existing" action that re-scans *uncategorized* transactions across
  all months (`ruleMatchesTransaction` in `src/lib/apply-rules.ts`). Already
  categorized transactions are never touched. When two or more rules match the
  same transaction with *different* categories, nothing is written silently —
  `resolve-rule-conflicts-dialog.tsx` asks per transaction. The success toast's
  "Show" action deep-links to `/[year]/[month]?highlight=<ids>`, which scrolls
  to and briefly ring-highlights those cards.

### Must have (not yet implemented)

- **Rule matching conditions: equals, contains, and starts with.** "Starts
  with" must match the beginning of the transaction name. Today
  `RuleCondition` (`src/lib/types.ts`) only supports `equals` | `contains` for
  the `name` field and `contains` | `not_contains` for `subtitle` — there is no
  `starts_with` operator anywhere in the type, `apply-rules.ts`'s matcher, or
  the `rule-editor.tsx` operator dropdown. All three need it added together,
  since a `starts_with` value saved by the editor is meaningless if
  `ruleMatchesTransaction`/`categoryIdForTransaction` don't check for it.
- **Default editable rules for new users.** A new user must receive a set of
  predefined rules on signup, editable/deletable like any other rule via the
  normal Rules-page flow (`rules-manager-panel.tsx`) — not a separate
  read-only "starter pack." Example: transactions whose name starts with
  Rema, Joker, Coop, Meny, or Kiwi → category "Matbutikk." No such seeding
  exists today — new users start with zero rules and zero categories beyond
  whatever `categories` seed the signup path already creates (see
  README for how users are provisioned, since there's no self-serve signup
  UI). This depends on the `starts_with` operator above, since the Rema/Joker/
  Coop/Meny/Kiwi example is a starts-with match, not a contains match (a
  `contains` rule for "Rema" would also catch an unrelated merchant with
  "Rema" mid-name).

### Should have (not yet implemented)

- **Flexible timeframe switcher (day / week / month / custom range).**
  Introduce a range-aware transaction view that lets the user switch between
  daily, weekly, monthly, and custom date ranges (e.g. last 7 days, last 3
  months, full year, or an arbitrary range) instead of being limited to one
  calendar month. Needs a range-aware query — `loadWorkspaceData` in
  `src/lib/workspace-data.ts` is hard-scoped to one `year`/`month` today — and
  the overview's aggregates (`src/lib/overview.ts`) would need to operate over
  an arbitrary transaction set rather than assuming "this month's rows."
  Month-to-month stepping (`month-nav.tsx`) already exists as the day/week/
  month granularity's base case; this generalizes it rather than replacing it.

### Could have (not yet implemented)

- **Personalization quiz (rule suggestions).** On first use, ask the user
  where they usually shop for groceries, beauty products, and similar
  categories, then generate suggested categorization rules from the answers
  into a dedicated suggestions section (distinct from the default-rules set
  above — these are personalized, not the same for every user, and presumably
  need an accept/dismiss step per suggestion rather than being created
  outright). Example: user answers "Blivakker" for beauty products → suggest
  a rule "name contains Blivakker → Hud og hårpleie." Depends on the default
  rules above landing first, since a suggestion is essentially the same
  create-rule mechanism seeded from quiz answers instead of a fixed list.
- **Month switcher only steps blindly.** `month-nav.tsx` always links to the
  adjacent month; it doesn't know which months have data, so there's no picker
  and no indication that a neighbouring month is empty. The `months` table
  already records which exist (`supabase/schema.sql`).
- **Edit raw transaction fields.** Only category/type/card_type/notes are
  editable; `description`/`date`/`amount` are rendered as plain text with no
  edit affordance, so a bank-export typo can't be corrected in the app.
- **Date-range filtering** on the overview list — it filters by text and by
  uncategorized / need-review, but not by date. Largely subsumed by the
  timeframe switcher above once that exists.
- **Trend charts.** The overview has a category breakdown and a split meter,
  but nothing over time (no month-over-month line or sparkline) — most useful
  once the timeframe switcher above gives it more than one month to plot.
- **Password reset.** `login-form.tsx` only supports sign-in
  (`signInWithPassword`) — no "forgot password" flow, no sign-up UI (per
  README, new users are created manually via the Supabase dashboard).
- **Multi-user / household sharing.** Every table's RLS policy is strictly
  `auth.uid() = user_id` (`supabase/schema.sql`) — there's no way for two
  people to share one household's data; each Supabase Auth user is fully
  isolated. Would need a real redesign (e.g. a `households` table) if ever
  wanted, not a small add-on.
- Upload a PNG/JPG screenshot of transactions (e.g. a bank app screenshot) and
  have them OCR'd/parsed into transactions, same as the Excel/CSV import path.

## Data model notes

- `transactions.type`: `common` | `personal` | `need_review` (Postgres enum
  `tx_type`). `need_review` transactions should be excluded from both the
  common and personal totals, but still counted in the overall total — see
  `src/lib/totals.ts`.
- `transactions.card_type`: `regular` | `credit`, defaults to `credit`. Not
  auto-detected from the statement — the user sets it manually per transaction.
- `transactions.location` / `transactions.notes`: nullable text.
- Re-uploading a statement (`src/app/api/upload/route.ts`) never overwrites
  fields on transactions that already exist for that month (matched by
  `source_hash`) — this protects the user's manual categorization from being
  clobbered on re-import. The one deliberate exception: `location` is
  backfilled on existing rows when it's currently `null`, since transactions
  imported before "Sted" column parsing existed have no other way to pick it
  up. Nothing else (category_id/type/card_type/notes) is ever touched this way.
- Schema changes live in `supabase/schema.sql` and must be re-run in the
  Supabase SQL editor manually — there's no migration runner in this project.
- **Known correctness risk**: the dedup key (`source_hash` in
  `src/lib/parse-transactions.ts`'s `computeSourceHash`) is
  `sha256(date|description.trim().toLowerCase()|amount.toFixed(2))`, enforced
  via `unique (month_id, source_hash)` in `supabase/schema.sql`. Two genuinely
  distinct transactions on the same day with the same description and amount
  (e.g. two identical coffee purchases) hash identically — the upload route's
  `ignoreDuplicates: true` upsert silently drops the second one on import,
  with no warning surfaced anywhere. Verified upload de-duplication otherwise
  works correctly for the common case (re-uploading a file with transactions
  you already have plus new ones only inserts the new ones, and never touches
  existing categorization) — see `src/app/api/upload/route.ts`.
