# Roadmap

Planned work that is **not yet implemented**. For what's already built (and
why), see the "Product requirements" section of [CLAUDE.md](CLAUDE.md).

## Must have

- **Automatic default-template seeding on signup.** The admin rule-templates
  page (`/admin/rules`, see CLAUDE.md) covers curating templates and applying
  one to an _existing_ user manually, but nothing yet runs
  `apply_rule_template` automatically when a brand-new user is created —
  there's no self-serve signup flow to hook into (see README on manual user
  provisioning), so this is still a manual step after creating a user in the
  Supabase dashboard.

## Could have

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
  timeframe switcher (CLAUDE.md) now that it exists.
- **Trend charts.** The overview has a category breakdown and a split meter,
  but nothing over time (no month-over-month line or sparkline) — the
  timeframe switcher's custom-range view (CLAUDE.md) makes this more useful
  than it used to be, since a range can now span more than one month.
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
