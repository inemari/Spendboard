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
- Categorize transactions via dropdown, drag-and-drop board (desktop), or the
  one-by-one "Categorize" screen (drag a card onto its category).
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

### Could have (not yet implemented)
- **View/switch between months, and view a custom timeframe.** Today there is
  no way to reach any month other than the current one except by hand-editing
  the `/[year]/[month]` URL (`src/app/page.tsx` just redirects to the current
  month; `src/components/app-header.tsx` renders `{month}/{year}` as plain
  text with no prev/next control or picker). Two tiers worth building:
  1. **Basic month switcher** — prev/next arrows and/or a picker in
     `AppHeader`/`NavMenu` to jump between months that have data (a `months`
     row already exists per user per year/month — `supabase/schema.sql`).
  2. **Timeframe/history view** — a new screen (e.g. `/history` or
     `/[year]/[month]/history`) showing transactions or totals aggregated
     across a chosen date range (a quarter, a year, "last 3 months") rather
     than one month at a time — for spotting trends, not just a single
     month's snapshot. Would need a range-aware query (currently
     `loadWorkspaceData` in `src/lib/workspace-data.ts` is hard-scoped to one
     `year`/`month`) and probably a lightweight chart (see below).
- **Edit raw transaction fields.** Only category/type/card_type/notes are
  editable; `description`/`date`/`amount` are rendered as plain text with no
  edit affordance, so a bank-export typo can't be corrected in the app.
- **Re-apply rules retroactively.** Rules only affect transactions at upload
  time (`categoryIdForTransaction` is called only inside the upload route's
  `parsed.map(...)` in `src/app/api/upload/route.ts`). Creating or editing a
  rule never re-scans already-uncategorized transactions in any month against
  it — worth an explicit "apply to existing uncategorized transactions"
  action on the Rules page.
- **Search/filter transactions** by text (description/location) or date range
  — no such control exists on the board or categorize screens today.
- **Spending charts/visualizations.** `summary-bar.tsx` is text-only numbers;
  no bar/pie/trend chart anywhere, despite unused `--color-chart-1..5` theme
  tokens already sitting in `src/app/globals.css` (leftover shadcn scaffold,
  suggesting this was anticipated but never built).
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
