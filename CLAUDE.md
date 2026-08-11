@AGENTS.md

# Spendboard

Spendboard turns a monthly bank statement into a categorized, at-a-glance view
of where your money went. Upload an Excel or CSV export, sort transactions by
drag-and-drop board, dropdown, or one-by-one review, and tag each as Common,
Personal, or Need review to track shared vs. personal spending side by side.
See [README.md](README.md) for setup and [DESIGN.md](DESIGN.md) for the
visual design system.

## Architecture map

- **Routes are flat and dateless.** `src/app/page.tsx` — the overview, the one
  screen with a timeframe and so the only one carrying date state, all of it in
  query params (`?view`/`?date`/`?from`/`?to`; a bare `/` is the current
  month). `src/app/categorize/`, `categories/`, `rules/` — account-wide, no
  dates. `src/app/admin/rules/` — admin rule-template management.
  `src/app/api/upload/` — the upload endpoint. `src/app/login/` — sign-in.
  There is deliberately **no `[year]/[month]` path segment**: it made every
  URL claim a month even on screens that have nothing to do with one, and it
  put a second month control (the header's) in competition with the overview's
  own. It also cost a full subtree remount whenever a week/day step crossed a
  month boundary. Do not reintroduce a date into any path.
- `src/components/` — UI. `ui/` holds shadcn primitives; everything else is
  app-specific (board, list, dialogs, headers).
- `src/lib/` — framework-free logic: parsing (`parse-transactions.ts`,
  `statement-formats.ts`), data loading (`workspace-data.ts`), aggregation
  (`overview.ts`, `totals.ts`), rules (`apply-rules.ts`, `rule-merge.ts`),
  and `supabase/` client setup.
- `src/hooks/use-transaction-actions.ts` — the shared mutation/undo logic
  used by both the board and categorize screen.
- `supabase/schema.sql` — the entire DB schema; no migration runner (see
  "Database changes").

## Component conventions

- **Inline JSX first.** Default to keeping JSX inline; extract into a
  component only when at least one applies: duplication (same pattern 2+
  times), a stable named domain/UI concept, variant pressure (conditionals
  dominating the markup), or a readability threshold (3+ major UI sections,
  or ~120–150+ lines of JSX hurting comprehension).
- **Server components by default.** Never add `"use client"` to
  `app/**/page.tsx`, `app/**/layout.tsx`, or `app/**/template.tsx`. Only
  create client components when the code genuinely requires client-side
  behavior.

## Product requirements

Below is what's actually built today, with the reasoning behind non-obvious
decisions. For work that's planned but not yet implemented, see
[ROADMAP.md](ROADMAP.md).

### Must have (implemented)

- Upload a bank statement (from the overview, whatever timeframe it happens to
  be showing — each transaction is filed under the month its own date falls in,
  so the upload carries no year/month of its own); transactions are parsed,
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
- The overview (`/`) is a **dashboard**
  (`transaction-board.tsx`): a hero "spent this month" figure, a common /
  personal / need-review split meter, a **clickable "Where it went" category
  sidebar** (`category-sidebar.tsx`, subcategory spend rolled into its
  parent, tail folded into "Other"), and a day-grouped, searchable transaction
  list (`transaction-list.tsx`) whose rows expand to reveal the full editor.
  The sidebar is navigation, not just a readout: clicking a category (or "All
  transactions" / "Uncategorized") scopes the list to it and shows a colored
  chip beside the "Transactions" heading; clicking the active row again
  resets to "All." Every row leads with a **pastel disc holding that
  category's icon** (`categories.icon` — see "Category icons" below), in the
  category's own `badge` color: a second recognition channel next to the color
  and the name, so the list can be scanned by shape rather than read.
  Each category gets its own accent color from a fixed
  rotation (`src/lib/category-colors.ts`) so it stays recognizable as a filter
  target — that's an identity/navigation color, unlike the single-hue spend
  bars this replaced, and doesn't need the categorical CVD palette's 8-hue
  cap, since the name is always shown as text alongside the color. A
  desktop-only **Overview / Board** toggle swaps the list for the drag-and-
  drop board. Spend-focused aggregates live in `src/lib/overview.ts`,
  deliberately separate from `totals.ts` (which nets income against expenses).
- **Month navigation lives only on the overview**, in the Month tab's step
  arrows on `timeframe-switcher.tsx`. The app header deliberately carries no
  month control of its own — it used to (a `month-nav.tsx` with prev/next
  arrows and the month title), which meant two competing month controls
  stacked above each other on the one screen that already had one. Any month
  is reachable; there is no "has data" check, so stepping into an empty month
  shows the empty state. The other screens don't name a month at all, because
  none of them is scoped to one.
- **Empty timeframes get their own state** (`transaction-board.tsx`), naming
  the range that came back empty via `formatRangeLabel` — an empty month
  suggests uploading a statement, an empty day/week/custom range suggests
  widening or stepping the range instead (there's nothing to upload *for* a
  sub-month range that the month itself doesn't already cover). This lives on
  the board, not in `transaction-list.tsx` — that component has its own
  "no transactions yet" state, but every panel below the toolbar is gated on
  `transactions.length > 0`, so the list never mounted to show it and the
  page rendered as a bare toolbar over blank space.
- Categorize transactions via dropdown, drag-and-drop board (desktop), or the
  one-by-one "Categorize" screen (drag a card onto its category — or use its
  Prev/Next arrows to step through the uncategorized list without touching
  it, same as the board carousel's stepper below). **The Categorize screen is
  account-wide** (`loadAllTransactions`): it works from every uncategorized
  transaction the user has, whatever month it fell in. Clearing the backlog
  isn't a per-month job — scoping it to one month left uncategorized
  transactions stranded on months the user had no reason to revisit, and there
  was no way to see how much was left overall. `categorize-screen.tsx`
  is a plain index into the uncategorized list, not a forward-only skip
  queue — Previous and Next are the same stepper, so "skip" and "go back"
  aren't two different mechanisms. Categorizing (or deleting) the current
  transaction removes it from the underlying list, which slides the next
  one into the same index for free, no separate "advance" step needed.
  - **Visual treatment: a soft pastel "constellation" of categories.** Each
    category is a rounded-square node (`NODE_SHAPE_CLASS` in
    `src/lib/organic-shapes.ts` — one consistent silhouette for every node;
    only *size* varies, never the outline) filled with the pastel gradient
    from its own `CategorySwatch` (`gradient`, plus a richer
    `gradientSelected` for the expanded one), with dark charcoal label text.
    A category with subcategories carries a "+N" badge. Each node also draws
    **the category's own icon above its label** (`categoryIcon`, same slug and
    same name-guess fallback as the overview sidebar), sized as a fraction of
    the node rather than a fixed size, since a node ranges from a full-size
    parent to a third-size satellite. Below ~52px the node drops the icon and
    keeps the label — the label is what identifies the category, and neither
    fits legibly at that size. Icons matter more here than anywhere else in
    the app: mid-drag the cursor and card are moving across the ring, which is
    exactly when a small text label is hardest to read.
  - **The transaction card sits at the centre and the categories orbit it**,
    absolutely positioned on an ellipse (`RING_RX_PCT` / `RING_RY_PCT`,
    percentages so the ring scales with the viewport rather than needing a
    breakpoint; wider than tall because a circle big enough to space nodes
    horizontally would run off the bottom of a laptop screen). Every other
    node is pulled inward by `RING_INNER_REACH` so neighbours interleave
    instead of sitting shoulder to shoulder on one line. Absolute positioning
    is load-bearing, not incidental: it's why expanding a cluster can't shove
    its neighbours around, which the earlier flow-layout version couldn't
    avoid. The whole screen is fixed to the viewport (`h-svh` +
    `overflow-hidden` on the page wrapper, `min-h-0` on the flex children) —
    the constellation is meant to be taken in at a glance, so it must never
    produce a scrollbar.
  - **`RING_RX_PCT`/`RING_RY_PCT` set how much *room* nodes have, not how far
    apart they look.** Node size is solved from that room, not the other way
    around — `ringLayout()` resolves every node's centre in container pixels,
    then `fitNodeScale()` finds the single largest scale at which no node
    overlaps another node, the card, or the container edge. Nodes are
    circles at known centres, so each constraint reduces to "this distance
    must cover both radii"; taking the smallest such bound across every
    pair is exact, not a heuristic. (An earlier version compared average
    ring arc length against node width, which says nothing about any
    *particular* pair and let a parent overlap its own subcategories once
    the ring got tight.) The result isn't capped at 1 — nodes grow into
    whatever room is actually there, bounded by `NODE_MIN_GAP`/
    `CARD_MIN_GAP`, up to `MAX_NODE_SCALE` (stops a sparse constellation
    inflating into a couple of huge circles) down to `MIN_NODE_SCALE`
    (stops a crowded one shrinking past readable). Tightening the ring
    percentages shrinks the categories rather than packing them closer —
    `NODE_MIN_GAP` is what governs visible spacing.
  - **A cluster's fan direction is chosen, not fixed.** Subcategories default
    to fanning *away* from the ring's centre so they don't open back over the
    card, but a node near the container edge has no room out there —
    `chooseFanAngle()` rotates the fan (smallest rotation first, alternating
    direction) until every satellite clears the edge, only swinging back
    toward the card as a last resort.
  - **Node sizing has a random-looking *base* that's actually deterministic.**
    `nodeSizeForIndex` and `scatterJitter` (the ring stagger) are both seeded
    off the category's index, never `Math.random()` — a real random call
    would pick different values on the server than the client (React reports
    that as a hydration mismatch) *and* re-roll on every render, so nodes
    would visibly jump around on each hover/drag/categorize. That base size
    then goes through `fitNodeScale()` (above) before anything renders, so
    the size on screen is "index-seeded base, scaled to fit" — not the base
    size itself.
  - **Subcategory nodes are a fixed fraction of their own parent** —
    `subcategorySizeRatio`: a third when there are more than three of them
    (so a wide fan still fits), otherwise ~0.55. Cluster geometry (orbit
    radius, fan direction) is resolved once per node in the parent screen,
    not inside `CategoryCluster`, because choosing a fan direction needs the
    node's resolved position in the measured container.
  - **A cluster expands on hover *or* when a drag is over it**, drawing thin
    translucent connector lines and concentric rings around the expanded
    node (`CategoryCluster`). The drag-over path is driven by dnd-kit's
    `onDragOver` rather than the nodes' own `mouseenter`: the drag captures
    the pointer, so hover events stop reaching the nodes underneath, and a
    cluster would otherwise never open while you drag toward it. Using hover
    at all (rather than "any drag in progress") matters too — an earlier
    version expanded every cluster the instant any drag started, which
    reflowed the whole ring before the cursor had moved and could shift the
    intended target out from under it, making aimed drops land on empty
    space. Drag-over expansion also needs
    `measuring: { droppable: { strategy: MeasuringStrategy.Always } }` on the
    `DndContext` — subcategories only occupy space once expanded, so with
    the default measure-once-at-drag-start they'd keep their collapsed
    zero-size rects and never become droppable.
  - Category creation is a **popover off a small "Add category" button**
    pinned below the ring — icon picker and name on one line, then "Where does
    it belong?" (its own category, or under an existing one), then Add. Not an
    always-visible form, so the constellation isn't competing with a form for
    attention, and not a form that *replaces* the button in place either
    (which moved the thing you'd just clicked out from under the cursor, and
    left a cramped stack of 8px-tall controls floating over the bottom of the
    ring). The icon picker sits before the name field and defaults to
    "Automatic", so it previews the icon the typed name would get on its own —
    the choice reads as "here's your icon, change it if you like" rather than
    another required decision.
- The board (`category-board.tsx`) is a **compact multi-row cockpit**: every
  category — plus Uncategorized — gets its own cell (`category-column.tsx`,
  still exporting `CategoryColumn`) in one wrapping grid
  (`grid-cols-[repeat(auto-fill,minmax(var(--col-min),1fr))]`,
  `auto-rows-(--row-h)`, `grid-flow-row-dense`), so all of them are visible
  together instead of paged through. A populated cell spans 2 columns/4 rows
  (`col-[span_2] row-[span_4]`) and scrolls its card list internally, so a
  busy category never grows the grid or throws a row out of alignment with
  its neighbors. `--col-min`/`--row-h` are driven by a `scale` state
  (base 6rem/4rem at `scale === 1`): an effect measures the grid's rendered
  height against the space left in the viewport below it and shrinks `scale`
  (down to `MIN_SCALE`) when it overflows, or grows it (up to `MAX_SCALE`)
  when there's slack — e.g. a sparse Day view shouldn't leave most of the
  screen blank just because most of its categories are empty. Resets to 1
  (and re-measures from there) whenever the cell count or window size
  changes, since changing the column width can let a different number of
  columns fit and reflow the dense-packed layout into a different number of
  rows, which can't be computed up front without actually laying it out.
  Note: `grid-flow-row-dense` can still leave a trailing gap when a row's
  cells don't add up to the full column count (a grid item can only occupy
  the tracks it's assigned, unlike a flex item it can't grow to absorb a
  neighboring empty one) — an attempt to close that gap by reading back and
  overriding each cell's auto-placed span via `getComputedStyle` made the
  layout misbehave badly enough to revert; if this is worth solving later it
  needs a different approach.
  A category with nothing in it (and nothing in any of its subcategories)
  instead renders `CategoryColumn`'s `compact` variant — the same colored
  header and dashed "Drop here" box, just a single 1x1 grid cell, with the
  amount/count/filter-menu chrome stripped out since there's nothing to
  show. Populated and compact cells share the one grid, sorted populated-
  first (stable, so each group keeps its original relative order) — `grid-
  flow-row-dense` is what lets a compact cell backfill an open cell next to
  a still-tall populated column instead of every empty category being
  pushed into its own section below (which is what plain row-major auto-
  placement, or two separate grids, would do). A category graduates back to
  its full cell the moment it receives a transaction. Uncategorized is just
  another cell
  in the same grid, not pinned separately — with everything on screen at
  once there's no longer a "the pile you drag from must share the viewport
  with whichever column you're viewing" constraint to design around.
  A category with subcategories doesn't get sibling cells for each of
  them — that would blow the all-visible-at-once budget fast. Instead its one
  cell stacks "General" (transactions with no subcategory) and every
  subcategory's own zone together, each its own drop target same as before
  subcategories shared a cell. A per-cell filter dropdown (funnel icon next to
  the title, checkbox per zone) lets the user hide zones they don't want to
  see or drop into right now — e.g. only two subcategories, or only
  "General" — and hiding a zone unmounts its drop target along with it. A
  "Filter categories…" box above the grid narrows which *cells* show, same
  idea one level up. Each category's cell color is stable and shared with the
  "Where it went" sidebar via `buildCategoryColorMap`
  (`src/lib/category-colors.ts`) — keyed by sort order among siblings, not
  spend rank, so a category's color never shifts between the two views or
  from month to month. Board cards use `TransactionCard`'s `compact` variant,
  which drops the category/type/card-type/delete controls (that editor stays
  one click away in the overview list) but keeps the note field — notes have
  no other surface on the board, unlike those other controls.
  - **Design history** (historical decision — do not treat as current
    implementation requirements): this went through three earlier shapes
    before landing here — a wrapping grid of collapsed summary tiles (felt
    like "too many tiles to scan" with 10+ categories), a wrapping grid of
    real always-expanded columns (solved the tile-scanning problem but
    reintroduced a wall of columns and pushed the page very tall), then a
    pinned-Uncategorized-column + carousel/stepper (Prev/Next arrows plus
    scroll-snap, one category visible at a time) that resolved "too many to
    scan" but traded it for "only ever seeing one category's worth of spend
    at a time." The fixed-height cockpit grid is what let every category be
    on screen simultaneously without either problem. Reconsider only if the
    task explicitly calls for redesigning this interaction — see git history
    on `category-board.tsx`/`category-column.tsx` if reviving an earlier
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
- **Category icons.** Every category can carry an icon, shown in the overview's
  "Where it went" sidebar. Picked from a curated, grouped set of lucide glyphs
  (`src/lib/category-icons.ts`) via `category-icon-picker.tsx` — on the
  Categories screen, both in the "Add a category" row and per existing category
  (changing it there saves immediately). The **stored value is our own stable
  slug** (`"shopping-cart"`), never a lucide export name: lucide renames
  components across major versions (`CircleHelp` no longer exists in the
  version pinned here), and a rename must not blank out icons users already
  saved. Icons are **optional** — `categories.icon` is nullable, and a category
  without one renders an icon *guessed from its name*
  (`guessCategoryIconKey`, Norwegian and English keyword hints) rather than a
  blank disc, so categories created before this existed still read as distinct
  symbols with no backfill. The picker's first entry ("Automatic") is that
  null state, previewing whatever the guess currently resolves to.
- **Default categories ship with icons already set.** A brand-new account is
  seeded once with the list in `ensure-default-categories.ts` (Groceries,
  Dining out, Transport, Housing, Utilities, Shopping, Health, Entertainment,
  Subscriptions, Other), each with its icon, so the sidebar reads as a set of
  recognizable symbols from the first upload. They're ordinary per-user rows
  from then on — renaming, re-iconing, reordering or deleting one only affects
  that user. The seed is skipped entirely once an account has any category, so
  it never resurrects something a user deleted.
- Per-category, per-month common/personal/overall totals; uncategorized count.
- Undo action on the toast shown whenever a transaction's category changes.
- The user avatar in `app-header.tsx` (top-right, desktop-only) opens
  `user-menu.tsx`'s dropdown: the signed-in email, and a destructive
  "Delete all transactions" item behind an `AlertDialog` confirmation. The
  delete is account-wide (every month, not just the current one) — the
  Supabase client call has no explicit filter beyond "id is set", since the
  `transactions` table's `auth.uid() = user_id` RLS policy already scopes
  it to the signed-in user's own rows. Categories and rules are untouched.
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
  `/rules` page and auto-applied to matching descriptions at upload time
  (`src/app/api/upload/route.ts`).
- Delete a transaction, single or bulk-selected, with an `AlertDialog`
  confirmation (`delete-confirm-dialog.tsx`, driven by
  `use-transaction-actions.ts`'s `pendingDelete`/`confirmDelete`/
  `dismissDelete` — the same pending-state pattern as
  `pendingSimilarMove`/`pendingRulePrompt` elsewhere in that hook). Category
  deletion (`category-manager-panel.tsx`) has its own local `AlertDialog`,
  since that component doesn't use the shared hook.
- The Rules page (`rules-manager-panel.tsx`) groups rules by their target
  category (parent categories before their subcategories, via
  `flattenWithDepth`), with rules targeting a deleted category collected into
  a trailing "Unknown category" group. A search box filters rules by matching
  against each rule's rendered description text (which already includes the
  category name), so searching a category name works without a separate
  filter control.
- **Re-apply rules retroactively.** Each rule card on the Rules page has an
  "apply to existing" action that re-scans _uncategorized_ transactions across
  all months (`ruleMatchesTransaction` in `src/lib/apply-rules.ts`). Already
  categorized transactions are never touched. When two or more rules match the
  same transaction with _different_ categories, nothing is written silently —
  `resolve-rule-conflicts-dialog.tsx` asks per transaction. The success toast's
  "Show" action deep-links to `/?date=<1st of that month>&highlight=<ids>`
  (`highlightHref` in `rules-manager-panel.tsx`, via `monthAnchorFor`), which
  scrolls to and briefly ring-highlights those cards, then clears the
  `highlight` param after a few seconds.
- **Rule matching conditions: equals, contains, starts with (name);
  contains, doesn't contain (subtitle).** `RuleCondition`
  (`src/lib/types.ts`), `apply-rules.ts`'s matcher, and the operator dropdown
  (now factored into the shared `rule-conditions-editor.tsx`, used by both
  `rule-editor.tsx` and the admin template editor below) all agree on the
  same operator set. "Starts with" matches the beginning of the normalized
  name (`normalizeDescription` already lowercases/strips punctuation, so
  this is a prefix check on that normalized string, not the raw text).
- **Admin rule templates (`/admin/rules`).** Named, reusable rule bundles an
  admin curates — distinct from a single user's own `rules` rows, since a
  template targets a category _by name_ (`rule_template_items.category_name`)
  rather than a `category_id`, making it portable across different users'
  distinct category sets. `admin-rules-panel.tsx` lists templates (each
  showing its items' plain-English description via
  `describeRuleConditions`), lets an admin create/edit/delete them, mark one
  `is_default` (a DB trigger enforces only one at a time), and apply any
  template to a chosen existing user on demand (there's no self-serve
  signup to hook a "new user" flow into yet, so applying is a manual,
  admin-triggered action for now — see README on how users are provisioned).
  Applying a template finds-or-creates each item's named category for the
  target user and inserts the corresponding rule; it never touches anything
  that user already has.
  - **Access control is a hardcoded admin email**, not a roles table — matches
    how this app is already single-owner/friends-and-family provisioned (see
    "Multi-user / household sharing" below). `is_admin()` in
    `supabase/schema.sql` is the actual enforcement (RLS on
    `rule_templates`/`rule_template_items`, plus a check inside both
    `SECURITY DEFINER` RPCs below); `src/lib/is-admin.ts`'s `isAdminEmail` is
    only a page-level redirect for a non-admin, not a security boundary by
    itself. **The email literal must match in both places** — there's no
    single source of truth between the SQL and the TS constant, since the
    TS side can't read a Postgres function at build time.
  - **Two `SECURITY DEFINER` RPCs** exist because the browser's anon-key
    client is _correctly_ blocked by every table's `auth.uid() = user_id`
    RLS policy from ever reading another user's email or writing rows with
    a different `user_id` — that's the whole point of that policy elsewhere
    in the app. `list_app_users()` (reads `auth.users`, not exposed to the
    client otherwise) and `apply_rule_template(p_template_id, target_user_id)`
    (writes categories/rules owned by `target_user_id`) both run with
    elevated privileges specifically to make this one admin page the
    exception, gated by the same `is_admin()` check inside the function body
    rather than by RLS (RLS can't apply to a function's own internal
    queries the way it applies to a client's direct table access).

- **Flexible timeframe switcher (day / week / month / custom range), overview
  only.** `timeframe-switcher.tsx` adds Day/Week/Month/Custom tabs above the
  board on `/`. It is the app's **only** timeframe control, and the overview is
  the only screen that has one: categorize is account-wide, and categories and
  rules have nothing to do with dates.
  - **One optional `date` anchor is the whole of the URL's timeframe state.**
    `resolveRange(view, { date, from, to })` draws the span around it and
    `shiftByView(view, { date }, delta)` steps it; both take an anchor date
    rather than a year/month pair, which is what lets every route be dateless.
    Omit `date` and every view falls back to today, so a bare `/` is the
    current month. Params are omitted when they'd only restate that default
    (see `navigate`/`selectTab`), and `selectTab` re-resolves the anchor
    through the *target* view so switching Day → Month carries the month over
    as its 1st instead of leaving an arbitrary day in the URL.
  - Every read goes through `loadWorkspaceDataForRange` in
    `src/lib/workspace-data.ts`, which queries `transactions` by `date`
    (`.gte`/`.lte`, backed by the additive `transactions_user_id_date_idx`
    index). `computeOverview`/`computeTotals` needed no changes — they already
    operated on a flat `Transaction[]` with no month assumption. Date-range
    math (`resolveRange`, `shiftByView`, `shiftMonth`, `monthAnchorFor`,
    `formatRangeLabel`) all lives in `src/lib/date-range.ts`.
  - **The custom range's from/to fields live in a popover on the Custom tab**,
    not inline beside the tabs. Clicking Custom opens the menu (seeded from
    whatever range is currently showing) and only its **Show me** button
    navigates — so
    picking a start date no longer half-applies a range while the end date is
    still the old one. Once applied, the label slot shows the range in words
    where the day/week/month arrows would be (a custom span has no natural
    next/previous to step to). The popover primitive is
    `src/components/ui/popover.tsx`, wrapping Base UI's `Popover` — the same
    package `dropdown-menu.tsx` already uses; no new dependency.
  - **No navigation here ever touches the path** — every tab, arrow and range
    only rewrites query params on `/`. This started as a fix for one bug:
    routing to a different value of a dynamic path segment is a genuinely
    different page in Next.js App Router and remounts the whole subtree, which
    silently reset `transaction-board.tsx`'s Overview/Board toggle on every
    week-arrow click that crossed a month boundary. Keeping the month in the
    query string rather than the path removed the dynamic segment entirely, so
    the class of bug is gone rather than worked around.

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
- `categories.icon`: nullable text, holding a slug from
  `src/lib/category-icons.ts` (not a lucide export name — see "Category icons"
  above). Null means "no icon chosen", which renders one guessed from the
  category's name, so this column needs no backfill.
- **`transactions.month_id` is derived from the transaction's own `date`,** by
  the upload route (`monthOf` + a `months` upsert per distinct month in the
  file). A statement spanning a boundary therefore splits correctly: its June
  rows get June's `months` row and its July rows get July's.
  - **Never scope a read by `month_id` anyway; scope it by `date`.** Reads have
    no business joining through `months`, and the two must not be free to
    disagree.
  - Historical decision — do not treat as current implementation requirements.
    `month_id` used to be "which month page the upload was started from," the
    same value stamped on every row in the file. That made a credit-card
    period's July rows show up under August: the old month-scoped read rendered
    "Nothing here yet!" on July while the exact same July span in the Custom
    tab listed them, and August's total silently included them. It also meant
    re-uploading one file from two different month pages produced duplicate
    rows, since the `(month_id, source_hash)` dedup key differed. Both went
    away with the date-derived `month_id`; the dedup key itself is unchanged.
- Re-uploading a statement (`src/app/api/upload/route.ts`) never overwrites
  fields on transactions that already exist (matched by `month_id` +
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

## Database changes

There is no migration runner.

If changing the schema:
- update `supabase/schema.sql`
- preserve/review RLS policies
- call out any manual SQL the user must apply
- do not assume the schema change has been deployed

## Documenting historical decisions

When documenting a rejected or superseded design (e.g. an earlier UI shape,
architecture, or approach), mark it explicitly so it isn't mistaken for a
current requirement:

> Historical decision — do not treat as current implementation requirements.
>
> We previously tried...
> Reconsider only if the task explicitly calls for redesigning this interaction.

(The "Design history" bullet under the board section above follows this
pattern informally — new call-outs should use the explicit framing.)

## Important invariants

Do not change these unless the task explicitly requires it:

- Statement format is auto-detected from file content. Do not reintroduce a bank/format picker.
- Re-importing a transaction must not overwrite user categorization/type/card type/notes.
- `need_review` is neither common nor personal.
- Uncategorized and Need review are independent concepts.
- Admin authorization is enforced server-side/database-side; UI redirects are not security boundaries.
- Rules never silently overwrite an already categorized transaction.
- Retroactive rule application only considers uncategorized transactions.
- Category colors must remain stable across views and months.
- `categories.icon` stores our own slug, never a lucide component name, and
  stays nullable — don't backfill it or make it required.
- Transaction reads are scoped by `date`, never by `month_id`.
- No route carries a date in its path. The overview is the only screen with a
  timeframe, and it keeps it in query params.
- The Categorize screen is account-wide; don't scope it to a month.
- Do not install a new package when the repository already has a reasonable way to solve the problem. If a new dependency is genuinely warranted, explain why before adding it.
- Before introducing a new UI pattern, search existing components, shared constants, and nearby implementation for an established equivalent — reuse it rather than inventing a new one.

## Keep these instructions current

When the user gives feedback about *how* work should be done rather than
only *what* to build, determine whether it's a reusable project convention
or persistent workflow preference. If so, update this file (or the most
relevant instruction file), make the rule concrete enough to guide future
work, and phrase it so the same correction isn't needed again. Applies to
feedback about git workflow, testing expectations, responsiveness, component
architecture, documentation practices, database workflow, tooling, and
implementation conventions.

## Updating instructions

When the user says "add this to instructions:" or anything similar followed
by text: convert the request into a clear, concise instruction in this
file's style, identify the most appropriate existing section (or propose a
new one), and ask for confirmation in this format before applying:

> Add this instruction: <rewritten instruction>
> Under section: <section name>
> Confirm? (Yes / No / Edit text)

On "Yes," apply exactly as proposed. On "Edit text," revise per feedback and
re-confirm. On "No," stop without modifying the file. Never add a
duplicate — if the behavior is already covered, point that out and suggest
updating the existing instruction instead.

## Documentation consistency

When a change affects documented behavior, architecture, design, setup,
requirements, or scope, update the relevant documentation in the same
change. Before finishing: check whether README.md, DESIGN.md, CLAUDE.md,
ROADMAP.md, or other docs need updating; update every doc whose content
would become incorrect or misleading; keep updates scoped to the actual
change, not a rewrite of unrelated material; if unclear, inspect the doc and
judge whether it's affected. A change isn't complete while affected docs
still describe the old behavior. In the final summary, state which docs were
updated — or that relevant docs were checked and needed no change.

## Git Workflow

1. **One change, one branch.** Before starting any work, check the current branch. If on `main`, create and check out a new branch off `main` named for the task's subject area (`feature/...`, `fix/...`, `docs/...`) before making changes — never work directly on `main`.
2. **Verify before asking.** `npx tsc --noEmit` and `npm run build` must be clean. For UI/visual changes, verify in a headless browser against a throwaway fixture/dev-test route: screenshot it, check the console for errors, then delete the throwaway route before finishing.
3. **Ask before shipping.** Summarize what changed and ask for confirmation before committing, unless the user already said to just proceed.
4. **On confirmation:** commit, push, open a PR, merge into `main`.
5. **After merging: delete the branch**, both locally (`git branch -d`) and on the remote (`git push origin --delete`).
6. **No stray dev servers.** Before starting one: check whether the required port already has a listener, reuse an appropriate existing project server when safe, otherwise stop stale project listeners before starting a new one. After testing: stop any dev server started for the task and verify no stray server from the task remains running.
