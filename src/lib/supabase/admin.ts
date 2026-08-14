import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS entirely. Server-only: never import this
 * from a client component, and SUPABASE_SERVICE_ROLE_KEY must never be
 * exposed via NEXT_PUBLIC_. Its only use in this app is the Auth Admin API
 * (creating users from /admin/users), which has no RLS-respecting equivalent
 * — every other admin write path goes through a SECURITY DEFINER RPC instead.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
