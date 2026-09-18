# Spendboard application audit

Audit date: 2026-09-17  
Scope: authenticated browser flows at mobile and desktop sizes, application source,
production build, tests, lint, and the live `SpendBoardDB` Supabase project.

This document records observed defects. The implementation-ready backlog and
acceptance criteria live in [REQUIREMENTS.md](REQUIREMENTS.md).

## Critical and high-priority findings

### AUD-001 — Category board can violate React hook ordering

`CategoryColumn` returns its compact variant before calling `useState` and
`useDroppable`. The same keyed category can change from compact to populated
after a drag, changing the number of hooks called between renders and risking a
runtime crash. ESLint reports both conditional-hook violations.

- Location: `src/components/category-column.tsx`
- Requirement: `REQ-FUNC-001`

### AUD-002 — Credit-card upload displays an invoice UUID

The live "Which invoice?" dialog displayed the selected invoice's internal UUID
instead of its human-readable label. Its `SelectValue` only has a placeholder,
so Base UI renders the stored value after selection.

- Location: `src/components/upload-button.tsx`
- Requirement: `REQ-FUNC-002`

### AUD-003 — Supabase function privileges are over-broad

The live Supabase security advisor reported 19 `SECURITY DEFINER` functions
executable by `anon` and 21 executable by `authenticated`, including admin RPCs.
Most inspected functions contain authorization checks, so this is not evidence
of a confirmed privilege escalation, but it violates least privilege and leaves
unnecessary privileged endpoints exposed.

Two functions also have a mutable `search_path`, and leaked-password protection
is disabled.

- Location: `supabase/schema.sql`
- Requirements: `REQ-SEC-001`, `REQ-SEC-002`, `REQ-SEC-003`

### AUD-004 — Production database schema has drifted

The live project has no recorded migrations. It still exposes the obsolete
`complete_settlement` RPC even though the function is absent from the current
schema file and references the removed `settlements.per_member` column. Calling
that dead endpoint would fail.

- Location: live Supabase schema and `supabase/schema.sql`
- Requirement: `REQ-DATA-001`

### AUD-005 — Rule precedence is implicit

Rules are loaded newest-first and the first match wins. Overlapping rules
therefore have a hidden creation-time priority that users cannot inspect or
control. Adding a broad new rule can silently change later imports.

- Locations: `src/lib/workspace-data.ts`, `src/lib/apply-rules.ts`
- Requirement: `REQ-LOGIC-001`

## Medium-priority findings

### AUD-006 — Optimistic transaction writes can finish out of order

Category, type, card, invoice, and note changes are sent without sequencing.
Rapid edits to the same transaction can reach Supabase in reverse order, leaving
the stored row different from the optimistic UI. A failed older request can also
roll back a newer edit.

- Location: `src/hooks/use-transaction-actions.ts`
- Requirement: `REQ-LOGIC-002`

### AUD-007 — Uploads have no server-side size limit

The upload handler calls `request.formData()` and parses the entire file without
enforcing a maximum size. A large authenticated XLSX or PDF can consume excessive
memory or exceed the server execution window.

- Location: `src/app/api/upload/route.ts`
- Requirement: `REQ-SEC-004`

### AUD-008 — Statement deduplication can be unstable across exports

The source hash contains date, description, amount, and an occurrence index
relative to the current file. If a later overlapping export inserts another
identical transaction earlier in the file, occurrence numbers shift and can
produce false duplicates or additional rows.

- Location: `src/lib/parse-transactions.ts`
- Requirement: `REQ-LOGIC-003`

### AUD-009 — Overview repeats shared Supabase queries

`loadWorkspaceDataForRange()` and `loadHousehold()` both call
`loadCategoriesAndRules()`. The overview therefore repeats authentication,
category/rule queries, and the default-category check on every request.

- Locations: `src/app/page.tsx`, `src/lib/workspace-data.ts`
- Requirement: `REQ-PERF-001`

### AUD-010 — Settlement immutability relies mainly on the UI

The UI prevents attaching transactions to completed settlements, but the broad
owner RLS policy still permits direct transaction updates through the Data API.
Stored transactions can therefore diverge from a completed settlement's frozen
snapshot.

- Location: `supabase/schema.sql`
- Requirement: `REQ-DATA-002`

### AUD-011 — Database performance advisories are unresolved

Supabase reports 11 foreign keys without covering indexes and five RLS policies
that reevaluate `auth.uid()` for every row.

- Location: `supabase/schema.sql`
- Requirement: `REQ-PERF-002`

## Design and accessibility findings

### AUD-012 — Categorization canvas degrades on mobile

At the mobile viewport, category circles overlap, long labels are clipped, and
some targets sit partially outside the usable area. On desktop the opposite
problem appears: targets are spread across a large canvas and require long drag
distances while the active transaction card is small.

- Location: `src/components/categorize-screen.tsx`
- Requirement: `REQ-DESIGN-001`

### AUD-013 — Drag-and-drop lacks an equivalent accessible workflow

Category targets appear as text rather than actionable controls in the
accessibility tree. A hydration mismatch was also observed for dnd-kit's
generated `aria-describedby` identifier. Keyboard and assistive-technology
users need a direct category-selection alternative.

- Locations: `src/components/categorize-screen.tsx`,
  `src/components/category-board.tsx`
- Requirement: `REQ-A11Y-001`

### AUD-014 — Bulk-selection controls are hidden on touch devices

Transaction checkboxes are transparent until hover or focus. Touch users do not
receive the hover cue, making bulk selection difficult to discover.

- Location: `src/components/transaction-list.tsx`
- Requirement: `REQ-A11Y-002`

### AUD-015 — Overview search is unnamed to assistive technology

The live accessibility tree exposed the overview search box as an unnamed text
field because it has a placeholder but no label or `aria-label`.

- Location: `src/components/transaction-board.tsx`
- Requirement: `REQ-A11Y-003`

### AUD-016 — Category taxonomy and copy are inconsistent

The audited account had 47 categories with overlapping concepts such as
"Dagligvarer", "Dagligvarer og husholdning", and "Matvarer"; mixed Norwegian
and English labels; and spelling errors including "Abbonementer", "Resturant",
and "accesories". The categories header is also cramped on mobile.

- Requirements: `REQ-DESIGN-002`, `REQ-DESIGN-003`

### AUD-017 — Categorization count lacks timeframe context

The overview showed five uncategorized transactions for September while the
categorization page showed an account-wide backlog of thirteen. The account-wide
behavior is intentional, but the page does not explain it, so the counts appear
inconsistent.

- Location: `src/components/categorize-screen.tsx`
- Requirement: `REQ-DESIGN-004`

## Engineering-health findings

### AUD-018 — Lint is failing and scans generated nested worktrees

`npx eslint src` reports eight errors and four warnings in the active source,
including the conditional-hook defect. The normal `npm run lint` also traverses
nested `.claude` worktrees and their generated `.next` output, producing 14,529
mostly irrelevant findings.

- Locations: `eslint.config.mjs`, active source files reported by ESLint
- Requirement: `REQ-ENG-001`

## Verification baseline

- Production build: passed.
- Automated tests: 21 passed across three files.
- Source-only lint: failed with 8 errors and 4 warnings.
- Full lint command: failed with 14,529 findings because nested worktrees and
  generated output are included.
- No application files or database records were changed during the audit.

