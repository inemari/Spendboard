import { createClient } from "@/lib/supabase/server";
import { loadCategoriesAndRules } from "@/lib/workspace-data";
import { AdminRulesPanel } from "@/components/admin-rules-panel";
import type { AppUser, DefaultCategory, Rule, RuleTemplate, RuleTemplateItem } from "@/lib/types";

export default async function AdminRulesPage() {
  const supabase = await createClient();

  const [
    { data: templates, error: templatesError },
    { data: users, error: usersError },
    { categories, rules },
    { data: defaultCategories, error: defaultCategoriesError },
  ] = await Promise.all([
    supabase
      .from("rule_templates")
      .select("id, name, description, is_default, created_at, rule_template_items(*)")
      .order("created_at"),
    supabase.rpc("list_app_users"),
    loadCategoriesAndRules(supabase),
    supabase.from("default_categories").select("id, name, icon, sort_order, parent_id").order("sort_order"),
  ]);

  const normalizedTemplates: RuleTemplate[] = (templates ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    is_default: t.is_default,
    created_at: t.created_at,
    items: (t.rule_template_items ?? []) as RuleTemplateItem[],
  }));

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const myRules = (rules as Rule[])
    .filter((r) => categoryNameById.has(r.category_id))
    .map((r) => {
      const category = categories.find((c) => c.id === r.category_id)!;
      return {
        id: r.id,
        categoryName: categoryNameById.get(r.category_id)!,
        categoryParentName: category.parent_id ? (categoryNameById.get(category.parent_id) ?? null) : null,
        conditions: r.conditions,
        type: r.type,
      };
    });

  return (
    <>
      {(templatesError || usersError || defaultCategoriesError) && (
        <p className="m-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load admin data:{" "}
          {templatesError?.message ?? usersError?.message ?? defaultCategoriesError?.message}
        </p>
      )}

      <AdminRulesPanel
        templates={normalizedTemplates}
        users={(users ?? []) as AppUser[]}
        myRules={myRules}
        defaultCategories={(defaultCategories ?? []) as DefaultCategory[]}
      />
    </>
  );
}
