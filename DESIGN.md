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
