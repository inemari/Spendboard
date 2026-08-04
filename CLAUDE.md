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

### Should have (not yet implemented)
- **Verify upload de-duplication holds under partial overlap.** The claim
  (see "Must have" above and `src/app/api/upload/route.ts`'s
  `.upsert(rows, { onConflict: "month_id,source_hash", ignoreDuplicates: true })`)
  is that re-uploading a CSV containing transactions already in the app plus a
  few new ones only inserts the new ones. This hasn't been explicitly
  re-verified after later upload-route changes (rule auto-categorization) —
  double check before relying on it: upload a file, then re-upload the same
  file plus a handful of new rows, and confirm the count of newly-inserted
  transactions matches only the new ones (no duplicate cards, existing
  categorization untouched).

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
