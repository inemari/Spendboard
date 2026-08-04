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

### Could have (not yet implemented)
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
- Schema changes live in `supabase/schema.sql` and must be re-run in the
  Supabase SQL editor manually — there's no migration runner in this project.
