// Keep this in sync with the `is_admin()` Postgres function in
// supabase/schema.sql — that's what actually enforces access at the
// database level (RLS + the admin-gated RPCs). This check is only for the
// app to redirect a non-admin away from /admin/rules before it renders;
// it is not itself a security boundary.
const ADMIN_EMAILS = ["ine@live.no", "inebredes1@gmail.com"];

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email);
}
