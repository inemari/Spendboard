# Spendboard

Monthly expense management app. Upload a bank statement (Excel/CSV), categorize
transactions, and track common vs. personal spending per month.

Stack: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Supabase (Postgres, Auth) + dnd-kit.

## Setup

1. Create a Supabase project at https://supabase.com.
2. In the Supabase SQL editor, run [`supabase/schema.sql`](supabase/schema.sql) to create the
   `categories`, `months`, and `transactions` tables with row-level security.
3. In Supabase Auth settings, create yourself a user (Authentication > Users > Add user),
   or enable email sign-ups temporarily to self-register, then disable sign-ups again.
4. Copy `.env.local.example` to `.env.local` and fill in your project URL and anon key
   (Supabase dashboard > Project Settings > API).
5. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

6. Open http://localhost:3000 — you'll be redirected to `/login`, then to the current
   month's workspace after signing in.

## Project structure

- `src/app/[year]/[month]/page.tsx` — the main monthly workspace.
- `src/app/login/page.tsx` — Supabase Auth login.
- `src/lib/supabase/` — browser/server Supabase clients + session-refresh middleware.
- `src/middleware.ts` — redirects unauthenticated requests to `/login`.
- `supabase/schema.sql` — database schema and RLS policies to run in Supabase.

## Roadmap (post-scaffold)

- File upload + parsing (Excel/CSV) into `transactions`.
- Transaction cards with category dropdown and Common/Personal toggle.
- Drag-and-drop category columns (desktop) / bottom sheet (mobile).
- Per-category and monthly totals.
- Custom category management.
