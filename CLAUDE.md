@AGENTS.md

# Spendboard

Spendboard turns a bank statement into a categorized, at-a-glance view of
where your money went. Upload an Excel, CSV, or PDF export, sort transactions
by drag-and-drop board, dropdown, or one-by-one review, and tag each as
Common, Personal, or Need review to track shared vs. personal spending side
by side. See [README.md](README.md) for setup, [DESIGN.md](DESIGN.md) for the
visual design system, and [ROADMAP.md](ROADMAP.md) for what's planned next.

## Architecture map

- **Routes are flat and dateless.** `src/app/page.tsx` — the overview, the one
  screen with a timeframe and so the only one carrying date state, all of it in
  query params (`?view`/`?date`/`?from`/`?to`; a bare `/` is the current
  month). `src/app/categorize/`, `categories/`, `rules/` — account-wide, no
  dates. `src/app/admin/` — the admin area (`users/`, `households/`,
  `rules/`, `categories/`; see "Admin area" below), gated in one place by
  `src/app/admin/layout.tsx`. `src/app/settlement/` — the shared credit-card
  settlement screen, also
  account/household-wide and dateless (see "Shared credit-card settlement"
  below). `src/app/api/upload/` — the upload endpoint. `src/app/login/` —
  sign-in.
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
  - **Nodes fade in rather than snapping to their measured size on load.**
    The page is server-rendered, so the first paint has no client-side
    container measurement to compute a scale from; `fitNodeScale` falls
    back to `MIN_NODE_SCALE` (deliberately the *small* end, not 1 — a
    correction that shrinks reads as less broken than one that grows, if
    one ever becomes visible) until `useElementSize`'s `useLayoutEffect`
    measures the real size, which it does synchronously on mount rather
    than waiting for `ResizeObserver`'s own (inherently async) first
    callback. Nodes stay at `opacity-0` until `measured`, with the opacity
    transition's `delay-` matched to the node's own width/height transition
    duration — so if the size correction does take a moment, it happens
    invisibly and the node only ever appears already at its final size.
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
    card, but two things can make that direction unusable: a node near the
    container edge has no room out there, and a node near a *sibling* has no
    room that way either. `chooseFanAngle()` treats both the edge and every
    other top-level node as obstacles, rotating the fan (smallest rotation
    first, alternating direction) until every satellite clears all of them,
    only swinging back toward the card as a last resort. The sibling check
    is load-bearing, not cosmetic: a satellite whose circle overlaps a
    neighbour's gives dnd-kit two droppables with genuinely overlapping
    hit-rects at the same point, and its collision detection doesn't
    reliably resolve that in the visually-topmost (satellite's) favor — a
    drag aimed at the satellite could land on the sibling underneath it.
    Confirmed both ways: `elementFromPoint` said the satellite, dnd-kit said
    the sibling.
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
    cluster would otherwise never open while you drag toward it — and, for
    the same reason, `hovered` is *not* a backstop during a drag despite an
    earlier version of this doc claiming real cursor movement keeps firing
    it; pointer capture suppresses mouseenter/mouseleave on everything else
    for the duration. Using hover at all when *not* dragging (rather than
    "any drag in progress" being the sole trigger) matters too — an earlier
    version expanded every cluster the instant any drag started, which
    reflowed the whole ring before the cursor had moved and could shift the
    intended target out from under it, making aimed drops land on empty
    space. Drag-over expansion also needs
    `measuring: { droppable: { strategy: MeasuringStrategy.Always } }` on the
    `DndContext` — subcategories only occupy space once expanded, so with
    the default measure-once-at-drag-start they'd keep their collapsed
    zero-size rects and never become droppable.
  - **`stickyClusterId` keeps a cluster open through the gap between a
    parent's droppable rect and a satellite's**, not just while `onDragOver`
    reports one of them directly. That gap is real screen space neither rect
    covers, so a straight-line drag from the parent's centre toward a
    satellite passes through a moment where dnd-kit's `over` is genuinely
    null; collapsing immediately on that null closed the satellites —
    which were the actual drop target — before the pointer could reach
    them. A short grace period (`STICKY_CLUSTER_GRACE_MS`) bridges it,
    cancelled if the same cluster is re-entered first. The satellite reveal
    transition is also deliberately fast (100ms, not the ~300ms it used to
    be): dnd-kit measures a satellite's *current* geometry, not its final
    resting one, so a slow reveal widens the window where a fast drag can
    reach a satellite's final position before its droppable rect has
    caught up there.
  - Category creation is a **popover off a small "Add category" button**
    pinned below the ring — the same icon/Name/Parent fields as everywhere
    else (see "Shared category-creation fields" below), then Add. Not an
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
- **Update default categories without losing personal categories.** The
  Categories page's "Update Categories" button calls
  `sync_default_categories()`. It compares the caller's category tree with
  `default_categories` using case/whitespace-insensitive names, reuses an
  existing matching top-level parent, and adds only missing parents or
  subcategories beneath the correct parent. It never renames, moves, edits,
  or removes an existing category, so transactions and rules remain intact.
  Re-running it when the user is fully synchronized is a safe no-op.
- **Shared category-creation fields.** `category-create-fields.tsx`'s
  `CategoryCreateFields` (icon picker + labeled Name field + labeled Parent
  select, plus the shared `NO_PARENT_VALUE` sentinel and "No parent
  (top-level category)" / plain-name wording) is the one place those fields
  are defined, used by the Categories screen's panel, the admin default-
  categories panel, and the Categorize screen's popover — three different
  screens can create a category, and the fields must read identically on all
  of them. It renders only the fields, not the submit button or surrounding
  chrome (card panel vs. popover vs. toggled form) — those legitimately
  differ per screen, but drifting the *fields* apart (different labels,
  different "no parent" wording) is what this component prevents.
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
  filter control. Each group is headed by the category's own icon badge and
  color (`buildCategoryColorMap`/`categoryIcon`, the same pair the overview
  sidebar and board use) plus a count pill, and every rule underneath renders
  as a single full-width row: field/condition/value pills on the left, the
  category's icon+name repeated on the right. A rule row is read-only at
  rest — hover reveals its apply/edit/delete icons — so editing always goes
  through one explicit action rather than always-editable inputs sitting in
  the row. **Creating** a rule is a separate fast path from **editing** one:
  the "+ New Rule" button opens `rule-quick-add-form.tsx`, an inline panel
  (not a dialog) for the common single-condition case, reusing
  `findMergeTarget`/`mergeValuesIntoRule` from `rule-merge.ts` to fold into an
  existing rule with the same category/field/operator instead of creating a
  duplicate. `rule-editor.tsx`'s dialog is edit-only now — multiple AND'd
  conditions, or changing a rule's field/operator/category after the fact,
  go through it via each row's pencil icon. Field/operator display labels
  (`src/lib/rule-labels.ts`) read "Description"/"Location" rather than the
  raw `name`/`subtitle` column keys, matching the product's own terminology
  for those transaction columns (see the upload notes above).
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
- **Update default rules without losing personal rules.** Rules copied from
  an admin template carry `rules.is_default = true`; rules users create are
  personal (`false`), and manually editing or merging into a default rule
  turns that customized copy personal. `rules-manager-panel.tsx`'s "Update
  Rules" button calls `apply_default_rule_template()`, which deletes only the
  caller's managed default rules and recreates that set from every admin
  template item while leaving every personal rule
  untouched. The delete/reapply sequence is one database transaction,
  so any failure rolls the whole refresh back. It also find-or-creates named
  categories just like `apply_rule_template`; already-categorized
  transactions are untouched. If there are no templates, the synchronized
  managed set is simply empty.
- **Rule matching conditions: equals, contains, starts with (name);
  contains, doesn't contain (subtitle).** `RuleCondition`
  (`src/lib/types.ts`), `apply-rules.ts`'s matcher, and the operator dropdown
  (now factored into the shared `rule-conditions-editor.tsx`, used by both
  `rule-editor.tsx` and the admin template editor below) all agree on the
  same operator set. "Starts with" matches the beginning of the normalized
  name (`normalizeDescription` already lowercases/strips punctuation, so
  this is a prefix check on that normalized string, not the raw text).
- **Admin area (`/admin/*`).** Four tabs under one gate
  (`src/app/admin/layout.tsx`, tab bar in `admin-tabs.tsx`): Users,
  Households, Rule templates, Default categories.
  - **Access control is a hardcoded admin email**, not a roles table — matches
    how this app is already single-owner/friends-and-family provisioned.
    `is_admin()` in `supabase/schema.sql` is the actual enforcement (RLS on
    every admin-only table, plus a check inside every `SECURITY DEFINER` RPC
    below and inside `/api/admin/create-user`); `src/lib/is-admin.ts`'s
    `isAdminEmail` is only a page-level redirect for a non-admin (checked
    once, in the shared `/admin` layout, not per-page), not a security
    boundary by itself. **The email literal must match in both places** —
    there's no single source of truth between the SQL and the TS constant,
    since the TS side can't read a Postgres function at build time.
  - **Users tab** (`admin-users-panel.tsx`) lists every account
    (`list_app_users()`) and can create a new one directly — the only admin
    action that needs Supabase's Auth Admin API rather than a plain RPC,
    since creating an `auth.users` row isn't something any RLS-respecting
    SQL function can do. `/api/admin/create-user` is a server route that
    re-checks `is_admin()` under the caller's own session before touching
    anything, then uses `src/lib/supabase/admin.ts`'s service-role client
    (`SUPABASE_SERVICE_ROLE_KEY`, server-only, never `NEXT_PUBLIC_`) to call
    `auth.admin.createUser`. This is the one place in the app that holds a
    key capable of bypassing RLS entirely — it must never be imported into
    anything that runs in the browser.
    Each user row also has one **"Update all"** action backed by
    `admin_sync_user_defaults(target_user_id)`: in one transaction it adds
    missing default categories/subcategories and replaces only that user's
    managed rules with every current admin template. Personal categories and
    rules are preserved, and any failure rolls the entire combined update
    back instead of leaving half-applied defaults.
  - **Households tab** (`admin-households-panel.tsx`) lists every household
    (`admin_list_households()`) and pairs two chosen users directly via
    `admin_create_household(user_a, user_b)` — deliberately bypassing the
    self-serve invite-code flow in `/settlement` (see "Shared credit-card
    settlement" above), since an admin already controls both accounts'
    provisioning and a code exchange would just be extra steps. Same
    invariants as the self-serve path (at most two members, no double-join),
    enforced inside the RPC. **Editing a household is scoped to removing a
    member** (`admin_remove_household_member`), not dissolving the household
    outright — the household row and everything filed under it
    (`credit_invoices`, `settlements`) stays intact even if this leaves it
    with one member or zero, so a removal can never orphan settlement
    history. `admin_add_household_member(household_id, user_id)` is the
    counterpart, for re-pairing a one-member household with someone new
    (shown inline on that household's row instead of only through the
    top "pair two users" form, which only ever creates a *new* household).
  - There is deliberately no "dissolve a household" action — if that's ever
    needed, decide first what happens to a household's `credit_invoices`/
    `settlements` (today `settlements.invoice_id` has no `on delete`
    clause, so deleting a `credit_invoices` row under a completed settlement
    would simply fail).
  - **Rule templates tab** (`admin-rules-panel.tsx`): a "Copy from your own
    rules" section lists
    the admin's *personal* `rules` rows (from her own account, alongside
    everyone else's) and can copy any one of them into an existing template
    as a new `rule_template_items` row — a shortcut for turning a rule she
    already uses personally into something reusable, without retyping its
    conditions. Named, reusable rule bundles an admin curates — distinct
    from a single user's own `rules` rows, since a template targets a
    category _by name_ (`rule_template_items.category_name`) rather than a
    `category_id`, making it portable across different users' distinct
    category sets. Lists templates (each showing its items' plain-English
    description via `describeRuleConditions`), lets an admin create/edit/
    delete them, and apply any template to a chosen existing user on demand
    (there's no self-serve signup to hook a "new user" flow into yet, so
    applying is a manual, admin-triggered action for now — see README on how
    users are provisioned). Every item from every template is included when a
    user clicks "Update Rules," and newly provisioned users receive every
    template as well. Applying one template manually finds-or-creates each
    item's
    named category for the target user and inserts the corresponding rule as
    a managed default (`rules.is_default = true`); it never removes any rule
    that user already has. The user's "Update Rules" action later replaces
    this managed set with all current admin templates while preserving all
    personal rules.
    - **Each template item's category is picked from a cascading dropdown
      pair, not typed freehand.** The top-level `Select` lists
      `default_categories`' top-level rows; picking one that has children
      reveals a second `Select` for its subcategories (plus a "General (no
      subcategory)" option to stay at the parent). Both dropdowns are
      sourced from `default_categories`, not any one user's own
      `categories` — the persisted value is still just the picked name
      (`rule_template_items.category_name`), so the portability described
      above is unchanged; this only replaces how that name gets entered,
      cutting typos and category-name mismatches an admin would otherwise
      have to get exactly right by hand. Editing an existing item resolves
      its stored name back to the matching dropdown selection
      (`matchDefaultCategoryIds`); a name that no longer matches anything in
      the current default list (e.g. renamed/removed since) leaves both
      dropdowns unset, same as a brand-new item.
  - **Default categories tab** (`admin-categories-panel.tsx`) manages the
    `default_categories` table that `ensure-default-categories.ts` reads
    from when seeding a brand-new account — replacing what used to be a
    hardcoded array in that file. An admin can rename, re-icon, add, or
    delete a default category (including a **subcategory**, one level deep,
    same shape as `categories.parent_id` — `default_categories.parent_id`
    mirrors it, and `buildCategoryTree`/`flattenWithDepth` in
    `category-tree.ts` are generic over both types so this tab reuses the
    same tree logic as the per-user Categories screen). Deleting a row here
    is safe regardless of which action triggers it: `default_categories` is
    a seed template, fully decoupled from every user's own `categories`
    table the moment the seed runs, so it never touches any category a user
    already has — a deleted parent's subcategories go with it
    (`default_categories.parent_id on delete cascade`, same as the
    per-user table). **Deleting requires two sequential confirmations**
    (`pendingDelete`/`deleteConfirmStep` in that component) rather than the
    single `AlertDialog` used everywhere else a category is deleted — an
    admin's delete here is scoped to the shared seed template, not their own
    data, so the extra step is deliberate friction against a slip on shared
    state, not a data-safety requirement (see above: the delete itself can't
    corrupt anything already seeded). The delete RLS policy
    (`"admin can delete" on default_categories`) mirrors the existing
    insert/update policies, gated by `is_admin()`. Seeding a new account
    (`ensure-default-categories.ts`) clones parents first, then children,
    remapping each child's `parent_id` from the seed row's own id to the
    *new* per-user category id it was cloned into — a fresh `categories` row
    always gets its own generated id, never the seed row's.
  - **"Sync defaults to a user"** (same tab) pushes edits to
    `default_categories` onto an *existing* account, additively — the
    seed above only ever runs once, on a brand-new account with zero
    categories, so an admin who fixes or adds a default category otherwise
    needs an explicit synchronization step to backfill it.
    `admin_sync_default_categories(target_user_id)` (`supabase/schema.sql`)
    walks `default_categories` the same parents-then-children way the seed
    does, but inserts a category only when that user has none by that name
    in that position (case/whitespace-insensitive, same as
    `categories_user_parent_name_key`/`apply_rule_template`) — it never
    touches or removes anything the user already has, so it's safe to run
    repeatedly or on an account that's already fully synced (a no-op, 0
    inserted).
  - **Several `SECURITY DEFINER` RPCs** exist because the browser's anon-key
    client is _correctly_ blocked by every table's `auth.uid() = user_id`
    RLS policy from ever reading another user's email or writing rows with
    a different `user_id` — that's the whole point of that policy elsewhere
    in the app. `list_app_users()` / `admin_list_households()` (read
    `auth.users`, not exposed to the client otherwise),
    `apply_rule_template(p_template_id, target_user_id)` /
    `admin_sync_default_categories(target_user_id)` /
    `admin_sync_user_defaults(target_user_id)` (write categories/
    rules owned by `target_user_id`), and `admin_create_household(user_a,
    user_b)` (writes `household_members` rows for two other users) all run
    with elevated privileges specifically to make these admin actions the
    exception, gated by the same `is_admin()` check inside the function body
    rather than by RLS (RLS can't apply to a function's own internal
    queries the way it applies to a client's direct table access).

- **Shared credit-card settlement (`/settlement`).** Two-person households
  can settle a shared credit-card bill without either person ever seeing the
  other's individual transactions — only aggregate totals cross the privacy
  boundary, and only through `SECURITY DEFINER` RPCs that deliberately
  return less than the full row, the same pattern as `list_app_users`/
  `apply_rule_template` above. V1 scope: exactly two members, a 50/50 common
  split, no editing a settlement once completed.
  - **Pairing is self-serve, by invite code** (`create_household`,
    `create_household_invite`, `redeem_household_invite`) — there's no
    self-serve *signup* (see README), but pairing two already-existing
    accounts is a smaller ask than that. The inviter shares a generated code
    out-of-band; the invitee redeems it from their own `/settlement` screen.
    `household_members.user_id` is `unique`, capping V1 at one household per
    user, and both RPCs enforce the "at most two members" invariant
    server-side rather than trusting the client.
  - **`credit_invoices` is a household-shared billing period**, distinct
    from `month_id` (see ROADMAP.md's original "credit-card invoices"
    proposal, now implemented) — a card's "August" bill often includes
    late-July purchases, so credit transactions are optionally filed under
    a named invoice instead of strictly by transaction date.
    `transactions.credit_invoice_id` is nullable: a solo user (no household)
    never sees the invoice picker at all, and it only appears in
    `upload-button.tsx`'s flow when uploading a **credit** file for a user
    who has one. Invoices are created inline in that same dialog (existing
    dropdown or a new named one) — there's no separate "manage invoices" UI.
  - **`household_invoice_summary(invoice_id)` is the only place a member
    learns anything about their partner's spending.** It returns one row per
    household member; `personal_total` and `need_review_count` come back
    `null` for every row that isn't the caller's own, while `common_total`
    is always visible for both — masked server-side, not by trusting the
    client to discard fields it shouldn't have used. `complete_settlement`
    separately re-checks need-review status for **both** members internally
    and blocks with a generic error if either has any — the client is never
    told *whose* side is blocking, only that it's blocked.
  - **A settlement is a frozen snapshot, written once.** There is no
    settlement "draft" state stored in the database — an invoice with no
    row in `settlements` is simply open, and the settlement screen computes
    live totals via `household_invoice_summary` until `complete_settlement`
    is called. That RPC recomputes both members' totals server-side (the
    client can't do this itself without reading the partner's
    transactions), writes one `settlements` row capturing each member's
    `personal_total`/`common_total`/`contribution`/`amount_due` at that
    moment, and is one-way: nothing here is ever updated afterward, so a
    transaction recategorized later can't retroactively change a completed
    settlement. Either household member can call it — "mark complete" is
    not a two-party confirmation step.
  - **A member's recurring contribution defaults from
    `household_members.default_contribution`**, editable per-settlement in
    the open-invoice view before completing (with an optional "save as my
    default" checkbox that calls `set_default_contribution`). Only your own
    contribution is ever editable from your own account — a completed
    settlement's `per_member` entry for your partner always uses *their*
    stored default, never a value you supplied.

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
- **A user can't have two categories with the same name under the same
  parent** — `categories_user_parent_name_key` (`supabase/schema.sql`), a
  unique index on `(user_id, coalesce(parent_id, <sentinel>), lower(trim(name)))`.
  The `lower(trim(...))` matters as much as the index itself: it's what makes
  "Groceries", "groceries", and " Groceries " collide as the same name,
  matching the case/whitespace-insensitive lookup `apply_rule_template`/
  `apply_default_rule_template` already use when finding a category by name —
  a plain `name` index let those variants coexist as visually indistinguishable
  duplicate categories. This also exists to close a real race:
  `ensureDefaultCategories` (`src/lib/ensure-default-categories.ts`) does a
  plain "count categories, seed if zero" check with no lock, so two concurrent
  requests for the same brand-new account (e.g. Next.js prefetching several
  routes at once) could both see zero categories and both insert the full
  default set, producing N copies of every default category. The loser of the
  race now gets a `23505` on each insert, which `ensureDefaultCategories`
  treats as "already seeded" and looks up the existing row instead of
  erroring. `createCategory` (`src/lib/create-category.ts`) and the rename
  handlers in `category-manager-panel.tsx` pre-check case/whitespace-
  insensitively and translate a `23505` into "A category with that name
  already exists here." rather than surfacing the raw Postgres error.
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
- **The dedup key is occurrence-aware, not just date+description+amount.**
  `source_hash` (`src/lib/parse-transactions.ts`) is
  `sha256(date|description.trim().toLowerCase()|amount.toFixed(2))` for a
  row with no repeat elsewhere in the same file — unchanged from the
  original formula, so re-uploading an already-imported statement still
  matches those existing rows via `unique (month_id, source_hash)`
  (`supabase/schema.sql`). A row that shares that same date+description+
  amount with an earlier row in the file (e.g. two identical coffee
  purchases at the same place, minutes apart — the date column carries no
  time-of-day, so they're otherwise indistinguishable) gets its
  in-file occurrence index (1, 2, …) appended before hashing
  (`assignSourceHashes`), so it no longer collides with the first and both
  import. This assignment runs once over the whole file's rows in their
  original top-to-bottom order — re-uploading the same file reproduces the
  same order and the same occurrence indices, so it still dedupes correctly
  against what's already imported rather than re-inserting every repeat
  again. Verified upload de-duplication otherwise works correctly for the
  common case (re-uploading a file with transactions you already have plus
  new ones only inserts the new ones, and never touches existing
  categorization) — see `src/app/api/upload/route.ts`.
- `transactions.credit_invoice_id`: nullable, references `credit_invoices`,
  `on delete set null` (not `cascade` — there's no invoice-deletion UI, but a
  transaction must never be deleted as a side effect of one). Set only via
  the upload route, which validates server-side that the invoice actually
  belongs to a household the uploader is a member of before writing it —
  the id arrives from the client, so it can't be trusted at face value.
- `households` / `household_members` / `household_invites` /
  `credit_invoices` / `settlements`: see "Shared credit-card settlement"
  above for the full shape. `household_members.user_id` is `unique` (V1: one
  household per user). `settlements.per_member` is a frozen jsonb snapshot,
  never updated after insert — see that section's "frozen snapshot" note.
- `default_categories`: the admin-managed seed list (see "Admin area"
  above). Readable by every authenticated user (their own first load is what
  seeds their `categories` from it); only `is_admin()` can insert/update.
  No delete policy exists at all, matching the admin UI's own choice not to
  offer one — belt-and-suspenders, not because deleting a row here would
  actually be unsafe. `parent_id` (self-referencing, `on delete cascade`,
  one level deep) supports admin-managed subcategories in the seed list,
  mirroring `categories.parent_id`.

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
- A household member must never be able to read another member's
  `transactions` rows, `personal_total`, or individual need-review count —
  only `common_total` (and derived settlement figures) cross that boundary,
  and only through a `SECURITY DEFINER` RPC that masks the rest server-side.
- A completed `settlements` row is never updated or deleted; it stays a
  frozen snapshot regardless of later edits to the transactions it summarized.
- A settlement cannot complete while either household member has any
  `need_review` transaction on that invoice — enforced inside
  `complete_settlement`, not just in the UI.
- `SUPABASE_SERVICE_ROLE_KEY` (and `src/lib/supabase/admin.ts`, which holds
  it) must never be imported into client-side code or exposed via
  `NEXT_PUBLIC_`. It exists solely for `/api/admin/create-user`'s Auth
  Admin API call.
- Admin access is enforced by `is_admin()` in Postgres, checked inside every
  admin-gated RPC and API route — `isAdminEmail` in the TS layer is a
  redirect only, never itself the security boundary.
- Admin authorization is enforced server-side/database-side; UI redirects are not security boundaries.
- Rules never silently overwrite an already categorized transaction.
- Retroactive rule application only considers uncategorized transactions.
- Category colors must remain stable across views and months.
- `categories.icon` stores our own slug, never a lucide component name, and
  stays nullable — don't backfill it or make it required.
- A user can't have two categories with the same name (case/whitespace-
  insensitive) under the same parent — enforced by
  `categories_user_parent_name_key` in Postgres on `lower(trim(name))`, not
  just app-level checks. Don't remove it to "fix" a uniqueness error; that
  index is what stops concurrent default-category seeding from duplicating
  every row, and the `lower(trim(...))` is what stops near-duplicate names
  (different case or stray whitespace) from slipping past it.
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
