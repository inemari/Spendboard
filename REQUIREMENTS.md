# Spendboard remediation requirements

This is the prioritized implementation backlog derived from
[APP_AUDIT.md](APP_AUDIT.md). Requirement IDs should be referenced in commits,
pull requests, and follow-up agent tasks.

Priority meanings:

- **P0** — confirmed security breach or unrecoverable data loss; none confirmed.
- **P1** — user-facing breakage, material security exposure, or data-integrity risk.
- **P2** — important reliability, accessibility, performance, or usability work.
- **P3** — polish and maintainability.

## P1 requirements

### REQ-FUNC-001 — Make category board hook usage stable

The compact and populated category variants must not change hook order for the
same React component instance.

Acceptance criteria:

- Dragging the first transaction into an empty category does not throw or blank
  the board.
- Dragging the last transaction out of a category does not throw.
- `react-hooks/rules-of-hooks` passes for `category-column.tsx`.
- A component test covers both compact-to-populated and populated-to-compact
  transitions.

### REQ-FUNC-002 — Display invoice labels everywhere

Users must never see an invoice UUID as the visible selected value.

Acceptance criteria:

- The credit upload dialog renders the selected invoice label.
- Its accessible name/value also uses the label.
- Existing-invoice and new-invoice paths are covered by tests.
- Other placeholder-only ID-backed selects are audited for the same defect.

### REQ-SEC-001 — Restrict privileged RPC execution

Every `SECURITY DEFINER` function must explicitly revoke execution from
`PUBLIC` and `anon`, then grant only the minimum required role.

Acceptance criteria:

- `has_function_privilege('anon', ..., 'EXECUTE')` is false for all privileged
  application RPCs.
- Admin RPCs still enforce authorization inside the function body.
- Appropriate authenticated-user RPCs remain callable by authenticated users.
- Supabase's anonymous/authenticated `SECURITY DEFINER` advisor findings are
  cleared or individually documented as intentional.

### REQ-SEC-002 — Harden function search paths

All privileged and trigger functions must use an explicit safe `search_path`,
and object references must be unambiguous.

Acceptance criteria:

- Supabase's mutable-search-path findings are cleared.
- Functions still pass integration tests after hardening.

### REQ-DATA-001 — Introduce migration-controlled schema management

The repository must have an ordered migration history that can reproduce the
live schema and remove obsolete objects.

Acceptance criteria:

- The current live schema is captured as a baseline migration.
- A migration drops the obsolete `complete_settlement` function.
- A fresh database can be built from migrations and passes schema tests.
- CI detects migration drift between the repository and the target database.
- `README.md` no longer instructs developers to rely solely on rerunning one
  monolithic schema file.

### REQ-LOGIC-001 — Define deterministic rule precedence

Rule conflicts must have an explicit, user-understandable winner.

Acceptance criteria:

- Rules have a documented priority or deterministic specificity model.
- The Rules page exposes the effective order.
- Conflicting rules are detected before save or clearly flagged.
- Uploads and manual "apply rule" actions use the same resolver.
- Tests cover equals/starts-with/contains overlaps and equal-priority ties.

### REQ-LOGIC-002 — Serialize transaction mutations per row

Rapid changes to a transaction must not leave the database and UI in different
states.

Acceptance criteria:

- Writes to the same transaction are queued, versioned, or consolidated.
- A late response cannot overwrite a newer local state.
- Rollback restores only the failed mutation, not later successful edits.
- Tests simulate reversed response order and failed intermediate requests.

### REQ-DATA-002 — Enforce completed-settlement immutability in the database

Once a settlement is completed, protected transaction fields and invoice
membership must not be mutable through the Data API.

Acceptance criteria:

- Database policies or controlled RPCs reject relevant updates affecting a
  completed settlement.
- Upload, single-edit, and bulk-edit paths surface a useful error.
- Completed settlement totals remain reconcilable with protected transactions.
- Integration tests attempt bypasses through direct table updates.

## P2 requirements

### REQ-SEC-003 — Strengthen authentication policy

Acceptance criteria:

- Supabase leaked-password protection is enabled.
- Password requirements and recovery behavior are documented.
- Admin authorization is migrated from hard-coded email addresses to trusted
  application metadata or an equivalent server-controlled role.

### REQ-SEC-004 — Bound statement upload resource use

Acceptance criteria:

- A documented maximum file size is enforced before parsing.
- Oversized uploads return HTTP 413 with a friendly message.
- Extension, MIME type, and parser failures produce safe errors.
- Large PDF/XLSX tests verify bounded memory and execution behavior.

### REQ-LOGIC-003 — Make statement deduplication stable

Acceptance criteria:

- A stable transaction identity strategy is documented per supported bank
  format.
- Reuploading an identical file inserts zero duplicates.
- Uploading overlapping exports preserves genuinely distinct identical-value
  transactions.
- Adding an earlier identical row to a later export does not remap existing
  rows incorrectly.

### REQ-PERF-001 — Eliminate duplicate overview data loading

Acceptance criteria:

- Authentication, categories, rules, and default-category checks are loaded no
  more than once per overview request.
- Household and range data reuse the shared result.
- Error handling remains visible and independent for each data group.

### REQ-PERF-002 — Resolve actionable Supabase performance advisories

Acceptance criteria:

- Foreign keys used for joins/deletes have appropriate covering indexes.
- RLS policies use `(select auth.uid())` where applicable.
- Query plans for overview, categorization, and settlements are reviewed.
- Supabase performance advisors are rerun and remaining findings documented.

### REQ-A11Y-001 — Provide non-drag categorization

Acceptance criteria:

- A keyboard-accessible category picker can categorize the active transaction.
- Drag targets have correct roles, names, instructions, and focus behavior.
- Server and client render the same dnd-kit accessibility identifiers.
- The workflow is usable without a pointer and with reduced motion enabled.

### REQ-A11Y-002 — Make selection controls discoverable on touch

Acceptance criteria:

- Transaction selection controls are visibly discoverable without hover.
- Touch targets meet the application's minimum target-size standard.
- Selected state remains visually and programmatically clear.

### REQ-A11Y-003 — Label search and filter controls

Acceptance criteria:

- Overview and board search fields have stable accessible names.
- Icon-only controls have meaningful accessible labels.
- An automated accessibility check covers the primary pages.

### REQ-DESIGN-001 — Redesign responsive categorization layout

Acceptance criteria:

- At 320, 375, 768, 1024, and 1440 pixel widths, category labels remain
  readable and targets stay inside the viewport.
- Targets do not overlap or obscure each other.
- The active transaction and primary actions maintain clear visual priority.
- Typical drag distance is reduced on wide screens.

### REQ-DESIGN-002 — Rationalize category taxonomy

Acceptance criteria:

- Default categories use one product language and approved spelling.
- Synonymous defaults are merged or clearly differentiated.
- Updating defaults does not silently create overlapping user concepts.
- Existing users receive a safe review/merge workflow rather than destructive
  automatic changes.

### REQ-DESIGN-003 — Improve mobile category-management hierarchy

Acceptance criteria:

- The category count, helper copy, and primary actions fit without cramped
  columns at mobile widths.
- Primary and secondary actions have clear emphasis.
- Long category lists have useful search, grouping, or collapse behavior.

### REQ-DESIGN-004 — Explain categorization backlog scope

Acceptance criteria:

- The page states that the queue covers all time, not the selected overview
  month.
- Navigation from a monthly uncategorized count preserves or explains the
  transition to the account-wide backlog.

## P3 requirements

### REQ-ENG-001 — Restore a useful lint gate

Acceptance criteria:

- `npm run lint` exits successfully on the active source.
- Nested `.claude` worktrees, all nested `.next` directories, and generated
  build artifacts are excluded.
- Existing hook, effect, dependency, unused import, and JSX escaping findings
  are resolved rather than suppressed without justification.
- CI runs lint, tests, and the production build.

## Definition of done for remediation work

A requirement is complete only when its acceptance criteria are met, relevant
tests are added, the production build passes, source lint passes, and any
Supabase change is represented by a reviewed migration with advisors rerun.

