import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/is-admin";
import { AppHeader } from "@/components/app-header";
import { AdminTabs } from "@/components/admin-tabs";

/** Gates every /admin/* route in one place — each page below trusts that a
 * non-admin never reaches it (this redirect is only a page-level nicety; the
 * real enforcement is is_admin() in supabase/schema.sql, checked inside
 * every admin-gated RPC and the create-user API route). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) {
    redirect("/");
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[1600px] flex-col">
      <AppHeader userEmail={user?.email} />
      <AdminTabs />
      {children}
    </div>
  );
}
