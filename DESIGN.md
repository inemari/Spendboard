# Candy — Playful & Vibrant

## North Star: "Joyful Pop"
Bold, fun, and energetic. Saturated colors, pill-shaped elements, and bouncy microinteractions. Designed to delight.

## Colors
- **Primary (`#e040a0`):** Hot pink — primary actions and brand identity.
- **Secondary (`#7c52aa`):** Purple — secondary elements, tags, categories.
- **Tertiary (`#0096cc`):** Sky blue — informational, links, highlights.
- **Background (`#fef7ff`):** Very light pink-white — warm and playful.
- Use all three accent colors freely but with purpose. This palette is expressive.

## Typography
- **All fonts:** DM Sans — rounded, friendly, modern.
- Use bold weight for headings, medium for labels. Generous line-height.
- Slightly larger base size (16px body) for friendliness.

## Shapes & Motion
- **Border radius:** Full/pill on buttons and badges. 16-20px on cards.
- **Microinteractions:** Bouncy hover transitions (`transform: scale(1.03)`, spring-like timing).
- **Shadows:** Colorful — use tinted shadows matching the element color at 15-20% opacity.
  Example: pink button gets `box-shadow: 0 4px 16px rgba(224, 64, 160, 0.2)`.

## Components
- **Buttons:** Pill-shaped, solid fill, tinted shadow. Hover = slight scale + deeper shadow.
- **Cards:** Large radius (16px), white fill, tinted shadow. Hover = lift animation.
- **Badges/Tags:** Pill-shaped, pastel fill (`primary_fixed`), bold text.
- **Inputs:** Rounded (full radius), light fill, pink focus ring.

## Rules
- Embrace color contrast and saturation. Nothing should feel washed out.
- Rounded shapes everywhere — no sharp corners in this system.
- Animations should feel bouncy and playful, not stiff. Use ease-out curves.

## Implementation notes (Spendboard)
- Tokens live in `src/app/globals.css` (`:root` / `.dark` custom properties, plus the
  `@theme inline` block that maps them to Tailwind utilities like `bg-primary`,
  `text-tertiary`, etc.).
- `--tertiary` / `--tertiary-foreground` were added alongside the existing shadcn
  primary/secondary tokens to carry the sky-blue accent.
- `--ring` is set to the primary pink, so every focus ring app-wide (buttons, inputs,
  selects) is pink for free — no per-component overrides needed.
- `--radius` is tuned so the existing `rounded-lg`/`rounded-xl`/`rounded-2xl` scale in
  `src/components/ui/*` lands cards in the 16-20px range without touching every
  component's className.
- Fonts: DM Sans is loaded via `next/font/google` in `src/app/layout.tsx`, exposed as
  the `--font-sans` CSS variable that `globals.css` already expected.
- Pill shape + hover scale/shadow applied directly in `src/components/ui/button.tsx`,
  `input.tsx`, `badge.tsx`; lift/shadow on `card.tsx`. Category board columns and the
  Categorize screen's drop zones (`category-column.tsx`, `category-drop-zone.tsx`) got the
  same radius treatment since they're central, highly visible UI.

## Data visualization

The overview page's common/personal/need-review split meter uses `--chart-1`
/ `--chart-2` / `--chart-track`, which replaced the grayscale shadcn scaffold
tokens.

- **Only two categorical slots exist, on purpose.** Slot 1 is brand pink, slot 2
  is the sky-blue tertiary. Brand pink beside brand purple collapses under
  protanopia (ΔE 5.5, below the 6 floor), so purple is not a chart slot;
  reordering to pink → sky blue clears every gate with zero hex changes.
  "Need review" is a *state*, not a peer series, so it wears muted ink rather
  than a third hue.
- **Dark mode is re-stepped, not flipped.** The light steps sit above the dark
  lightness band, so dark uses `#ec3f9e` / `#2f9dc4`.
- Light passes clean (adjacent CVD ΔE 9.0). Dark lands at 7.7 — inside the 6–8
  warn band, which is legal *only* alongside secondary encoding. That's why the
  meter keeps a 2px surface gap between segments and always shows labelled
  swatches. Don't remove either without re-validating.
- Re-validate with the `dataviz` skill's `validate_palette.js` against this
  app's own surfaces (`#ffffff` light, `#241521` dark) before changing any of
  these values — don't eyeball colorblind-safety.

**The "Where it went" sidebar, the board's kanban columns, and the
categorize screen's category nodes share a different color job and don't use
the palette above.** None is a magnitude chart — every sidebar row, column
header, and category node always shows the category's name as text, so a
color there never carries meaning alone. Each category gets its own identity
color from a fixed rotation (`src/lib/category-colors.ts`'s
`buildCategoryColorMap`, same principle as the Rules page's column-header
gradients in `rules-manager-panel.tsx`), keyed by sort order among siblings
— not spend rank — so a category's color is the same everywhere it appears,
and doesn't shift from month to month. A `CategorySwatch` carries several
renderings of that one identity hue for different surfaces: a flat `bar`, a
`soft` pill, a `ring`, plus the soft pastel `gradient` / richer
`gradientSelected` pair the categorize screen's nodes use — all the same
underlying identity, so "selected" reads as more prominent without becoming
a different color.
Because the color is never the sole channel — the name is always printed
next to it — this rotation is *not* run through the categorical CVD
validator the way the split meter's palette is; it can safely exceed 8 hues if
more categories are added, which the validated categorical palette by
definition cannot.
