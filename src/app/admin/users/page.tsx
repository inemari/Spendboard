import { createClient } from "@/lib/supabase/server";
import { AdminUsersPanel } from "@/components/admin-users-panel";
import type { AppUser } from "@/lib/types";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: users, error } = await supabase.rpc("list_app_users");

  return (
    <>
      {error && (
        <p className="m-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load users: {error.message}
        </p>
      )}
      <AdminUsersPanel users={(users ?? []) as AppUser[]} />
    </>
  );
}
