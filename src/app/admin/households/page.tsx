import { createClient } from "@/lib/supabase/server";
import { AdminHouseholdsPanel } from "@/components/admin-households-panel";
import type { AppUser } from "@/lib/types";

export default async function AdminHouseholdsPage() {
  const supabase = await createClient();
  const [{ data: households, error: householdsError }, { data: users, error: usersError }] =
    await Promise.all([supabase.rpc("admin_list_households"), supabase.rpc("list_app_users")]);

  const rows = (households ?? []) as { household_id: string; user_id: string; email: string | null }[];
  const groups = new Map<string, { user_id: string; email: string | null }[]>();
  for (const row of rows) {
    const members = groups.get(row.household_id) ?? [];
    members.push({ user_id: row.user_id, email: row.email });
    groups.set(row.household_id, members);
  }
  const households_ = Array.from(groups.entries()).map(([householdId, members]) => ({
    householdId,
    members,
  }));

  const pairedUserIds = new Set(rows.map((r) => r.user_id));
  const unpairedUsers = ((users ?? []) as AppUser[]).filter((u) => !pairedUserIds.has(u.id));

  return (
    <>
      {(householdsError || usersError) && (
        <p className="m-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load households: {householdsError?.message ?? usersError?.message}
        </p>
      )}
      <AdminHouseholdsPanel households={households_} unpairedUsers={unpairedUsers} />
    </>
  );
}
