# Spendboard

Expense management app. Upload a bank statement (Excel, CSV, or PDF),
categorize transactions via drag-and-drop board, dropdown, or one-by-one
review, and track common vs. personal spending across any timeframe.

Stack: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Supabase (Postgres, Auth) + dnd-kit.

## Setup

1. Create a Supabase project at https://supabase.com.
2. In the Supabase SQL editor, run [`supabase/schema.sql`](supabase/schema.sql) to create the
   `categories`, `months`, `transactions`, `rules`, and shared-settlement
   (`households`, `credit_invoices`, `settlements`, etc.) tables with row-level
   security. There's no migration runner: re-run the same file after pulling
   any change that touches the schema. It's written to be safely re-runnable
   (every statement is `if not exists` / guarded).
3. In Supabase Auth settings, create yourself a user (Authentication > Users > Add user),
   or enable email sign-ups temporarily to self-register, then disable sign-ups again.
4. Copy `.env.local.example` to `.env.local` and fill in your project URL and anon key
   (Supabase dashboard > Project Settings > API). If you want the admin
   area's "create a new user" action to work, also fill in
   `SUPABASE_SERVICE_ROLE_KEY` from the same page — keep it secret, it
   bypasses row-level security entirely.
5. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

6. Open http://localhost:3000 — you'll be redirected to `/login`, then to the
   overview for the current month after signing in.

## Project structure

- `src/app/page.tsx` — the overview. The only screen with a timeframe, and the
  only one whose URL carries date state (`?view`/`?date`/`?from`/`?to`); a bare
  `/` is the current month.
- `src/app/categorize/`, `src/app/categories/`, `src/app/rules/`,
  `src/app/settlement/` — the other screens. All account-wide, no dates in
  their URLs.
- `src/app/admin/` — admin-only (gated by `src/lib/is-admin.ts` and, at the
  database level, `is_admin()` in `supabase/schema.sql`): manage users,
  pair users into households, manage rule templates, manage the default
  category seed list.
- `src/app/login/page.tsx` — Supabase Auth login.
- `src/lib/supabase/` — browser/server Supabase clients + session-refresh middleware.
- `src/middleware.ts` — redirects unauthenticated requests to `/login`.
- `supabase/schema.sql` — database schema and RLS policies to run in Supabase.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for work that's planned but not yet built.
