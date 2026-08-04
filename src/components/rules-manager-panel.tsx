"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RuleEditor, type RuleEditorTarget } from "@/components/rule-editor";
import { describeRule } from "@/lib/rule-description";
import type { Category, Rule } from "@/lib/types";

export function RulesManagerPanel({
  rules,
  categories,
}: {
  rules: Rule[];
  categories: Category[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [editorTarget, setEditorTarget] = useState<RuleEditorTarget | null>(null);

  async function deleteRule(id: string) {
    const { error } = await supabase.from("rules").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete rule.");
      return;
    }
    toast.success("Rule deleted");
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold">Rules</h2>
          <p className="text-sm text-muted-foreground">
            Rules auto-categorize matching transactions as soon as they&rsquo;re uploaded.
          </p>
        </div>
        <Button onClick={() => setEditorTarget({ mode: "create" })}>
          <Plus className="size-4" />
          Add rule
        </Button>
      </div>

      <RuleEditor target={editorTarget} categories={categories} onClose={() => setEditorTarget(null)} />

      {rules.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No rules yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {rules.map((rule) => {
            const category = categories.find((c) => c.id === rule.category_id);
            return (
              <Card key={rule.id} className="flex flex-row items-center gap-3 p-4">
                <p className="min-w-0 flex-1 text-sm">
                  {describeRule(rule.groups, category?.name ?? "Unknown category")}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditorTarget({ mode: "edit", rule })}
                  aria-label="Edit rule"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteRule(rule.id)}
                  aria-label="Delete rule"
                >
                  <Trash2 className="size-4" />
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
