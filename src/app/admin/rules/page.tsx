import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/is-admin";
import { AppHeader } from "@/components/app-header";
import { AdminRulesPanel } from "@/components/admin-rules-panel";
import type { AppUser, RuleTemplate, RuleTemplateItem } from "@/lib/types";

export default async function AdminRulesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) {
    redirect("/");
  }

  const [{ data: templates, error: templatesError }, { data: users, error: usersError }] =
    await Promise.all([
      supabase
        .from("rule_templates")
        .select("id, name, description, is_default, created_at, rule_template_items(*)")
        .order("created_at"),
      supabase.rpc("list_app_users"),
    ]);

  const normalizedTemplates: RuleTemplate[] = (templates ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    is_default: t.is_default,
    created_at: t.created_at,
    items: (t.rule_template_items ?? []) as RuleTemplateItem[],
  }));

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[1600px] flex-col">
      <AppHeader userEmail={user?.email} />

      {(templatesError || usersError) && (
        <p className="m-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load admin data: {templatesError?.message ?? usersError?.message}
        </p>
      )}

      <AdminRulesPanel templates={normalizedTemplates} users={(users ?? []) as AppUser[]} />
    </div>
  );
}
