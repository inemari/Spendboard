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

- Upload a bank statement for a given month; transactions are parsed,
  de-duplicated (by date+description+amount hash), and shown as cards. The
  upload button (`upload-button.tsx`) only asks for the file and the card
  type (Credit/Debit — see below); it does **not** ask which bank/export
  format the file is. `parseTransactionFile` in `parse-transactions.ts`
  auto-detects that instead: every format in `src/lib/statement-formats.ts`
  whose accepted extensions include the uploaded file's extension gets
  tried against the file's actual content (header aliases, and for CSV,
  field delimiter), and whichever extraction yields the most transactions
  wins — so the file's real columns settle any ambiguity, not a name picked
  from a dropdown. Known formats today: **SAS Eurobonus Kredittkort**
  (Excel/CSV), **Nordea Debit (PDF)**, **Nordea Debit (CSV)**. Adding a new
  bank/card format means adding one entry to `STATEMENT_FORMATS`, not
  touching the detection or parsing logic itself. This auto-detection
  replaced an earlier explicit format-picker dropdown — kept losing to real
  files whose actual columns didn't match what the user assumed their own
  bank's export was called (see the Nordea CSV note below), so matching
  against real content instead of a self-reported label proved more
  reliable in practice.
  - **Nordea Debit (CSV)** is UTF-8-with-BOM, semicolon-delimited, comma
    decimals, `YYYY/MM/DD` dates — same columns as the PDF format above, just
    a different export of the same account. The BOM is stripped for free by
    `File#text()`'s decoder; the semicolon delimiter is pinned via that
    format's `csvDelimiter` rather than left to Papaparse's auto-detection;
    the decimal comma and `YYYY/MM/DD` date are handled by
    `parseAmount`/`parseDate`'s existing separator-agnostic regexes in
    `parse-transactions.ts` (`parseDate` accepts `.`/`-`/`/` as the
    separator for both `DD~MM~YYYY` and `YYYY~MM~DD` orderings).
  - **PDF support only covers text-layer PDFs** (a real bank export, not a
    scanned/photographed page) — `pdfToRows` in `parse-transactions.ts`
    reconstructs table rows from PDF.js's positioned text runs by clustering
    runs into lines by y-position, locating the header row by the same alias
    matching `rowsToTransactions` uses elsewhere, then bucketing every later
    row's runs by the header's own x-positions (not by re-splitting on
    x-gaps) before feeding rows through the same header-detection/row-
    parsing path as the Excel/CSV sheets. Bucketing by position, not order,
    matters: a data row with a blank column (e.g. Nordea's empty
    `Referansenummer`) has one fewer gap than the header row, so naive
    left-to-right splitting silently shifts every later column out of
    alignment — reproduced and fixed against a real Nordea Brukskonto PDF
    export. A scanned PDF with no text layer yields no rows and fails the
    same "no valid transactions found" check as an empty spreadsheet.
- Each transaction card's **title is the description column** (`Spesifikasjon`
  for the Excel format, `Navn` for Nordea Debit), and its **subtitle is the
  location column** (`Sted` for Excel, `Betalingstype` for Nordea Debit),
  when present.
- The month workspace (`/[year]/[month]`) is an **overview dashboard**
  (`transaction-board.tsx`): a hero "spent this month" figure, a common /
  personal / need-review split meter, a **clickable "Where it went" category
  sidebar** (`category-sidebar.tsx`, subcategory spend rolled into its
  parent, tail folded into "Other"), and a day-grouped, searchable transaction
  list (`transaction-list.tsx`) whose rows expand to reveal the full editor.
  The sidebar is navigation, not just a readout: clicking a category (or "All
  transactions" / "Uncategorized") scopes the list to it and shows a colored
  chip beside the "Transactions" heading; clicking the active row again
  resets to "All." Each category gets its own accent color from a fixed
  rotation (`src/lib/category-colors.ts`) so it stays recognizable as a filter
  target — that's an identity/navigation color, unlike the single-hue spend
  bars this replaced, and doesn't need the categorical CVD palette's 8-hue
  cap, since the name is always shown as text alongside the color. A
  desktop-only **Overview / Board** toggle swaps the list for the drag-and-
  drop board. Spend-focused aggregates live in `src/lib/overview.ts`,
  deliberately separate from `totals.ts` (which nets income against expenses).
- **Month navigation**: prev/next arrows in `app-header.tsx` via
  `month-nav.tsx`. Any month is reachable; there is no "has data" check, so
  stepping into an empty month shows the empty state.
- Categorize transactions via dropdown, drag-and-drop board (desktop), or the
  one-by-one "Categorize" screen (drag a card onto its category).
- The board (`category-board.tsx`) is built for **10+ categories with 0–5
  subcategories each** as a real kanban board (`category-column.tsx`: cards
  always visible, not hidden behind an expand click), scaled two ways instead
  of showing every column simultaneously:
  1. **Uncategorized is pinned**, full height, to the left — it's the pile you
     drag *from*, so both ends of a drag (it, and whichever category column
     you're currently viewing) must be on screen together.
  2. **The category columns are a carousel/stepper**, not a wrapping grid or a
     horizontal scroller you drag across: Prev/Next arrows step exactly one
     column (with a "3 / 12" counter), while the track underneath is a plain
     `overflow-x-auto` + `scroll-snap` region, so a trackpad swipe or a normal
     scrollbar drag works too — the arrows aren't the only way through. A
     "Filter categories…" box (past 6 categories) steps *outside* the
     carousel entirely: matches wrap into a plain grid, since a filtered set
     is usually a handful, not something worth paging through.
  Each category's column color is stable and shared with the "Where it went"
  sidebar via `buildCategoryColorMap` (`src/lib/category-colors.ts`) — keyed
  by sort order among siblings, not spend rank, so a category's color never
  shifts between the two views or from month to month. Every column caps its
  own card-list height with an internal scrollbar (`bodyClassName` override on
  `CategoryColumn` for Uncategorized's viewport-height version) so an uneven
  card count between columns never distorts the row. Board cards use
  `TransactionCard`'s `compact` variant, which drops the category/type/card-
  type/delete controls (that editor stays one click away in the overview
  list) but keeps the note field — notes have no other surface on the board,
  unlike those other controls.
  - **Design history**: this went through two earlier shapes before landing
    here — first a wrapping grid of collapsed summary tiles (ADR: felt like
    "too many tiles to scan" with 10+ categories), then a wrapping grid of
    real always-expanded columns (ADR: solved the tile-scanning problem but
    reintroduced a wall of columns, and pushed the page very tall). The
    carousel is what actually resolved "too many to scan" — see git history
    on `category-board.tsx`/`category-column.tsx` if reviving either earlier
    shape ever seems tempting.
- **Search/filter transactions** by description or location, plus All /
  Uncategorized / Need review filters, on the overview list.
- Optional one-level subcategories (e.g. "Hud/hår-pleie" → "Hår").
- Toggle each transaction between **Common**, **Personal**, and **Need review**
  (a third state for "haven't decided yet" — distinct from being uncategorized).
- Free-text **note** field per transaction.
- Per-transaction **card type**: Credit vs. Debit card. Chosen once per
  upload (`upload-button.tsx`'s card-type dialog, shown before the file
  picker opens) and applied to every transaction parsed from that file —
  not auto-detected (unlike the statement format itself), and not editable
  per-file after the fact. Individual transactions can still be corrected
  afterward via the per-card toggle or the bulk action bar.
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
  have them OCR'd/parsed into transactions, same as the Excel/CSV/PDF import
  path. Deliberately still open: a scanned/photographed page has no PDF text
  layer, so it can't reuse `pdfToRows` and needs actual OCR (e.g.
  tesseract.js) instead of text-run positions.

## Data model notes

- `transactions.type`: `common` | `personal` | `need_review` (Postgres enum
  `tx_type`). `need_review` transactions should be excluded from both the
  common and personal totals, but still counted in the overall total — see
  `src/lib/totals.ts`.
- `transactions.card_type`: `debit` | `credit` (Postgres enum `card_type`,
  renamed from `regular` to `debit` — `supabase/schema.sql` renames the
  existing enum label in place, so old rows keep their value under the new
  name with no backfill needed), defaults to `credit`. Set once per upload
  via the upload button's card-type dialog (applied to every transaction in
  that file) or corrected manually afterward per transaction/selection.
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
