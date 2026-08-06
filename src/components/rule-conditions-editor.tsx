"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RuleCondition } from "@/lib/types";

export const EMPTY_CONDITION: RuleCondition = { field: "name", operator: "equals", values: [""] };

/** The AND/OR condition-builder shared by the rule editor (rule-editor.tsx)
 * and the admin rule-template editor (admin-rules-panel.tsx) — same shape of
 * conditions, same editing UI, just a different save target. */
export function RuleConditionsEditor({
  conditions,
  onChange,
}: {
  conditions: RuleCondition[];
  onChange: (next: RuleCondition[]) => void;
}) {
  function setConditionField(index: number, field: RuleCondition["field"]) {
    onChange(
      conditions.map((c, i) => {
        if (i !== index) return c;
        return field === "name"
          ? { field: "name", operator: "equals", values: c.values }
          : { field: "subtitle", operator: "contains", values: c.values };
      }),
    );
  }

  function setConditionOperator(index: number, operator: string) {
    onChange(conditions.map((c, i) => (i !== index ? c : ({ ...c, operator } as RuleCondition))));
  }

  function setConditionValue(index: number, valueIndex: number, value: string) {
    onChange(
      conditions.map((c, i) =>
        i !== index ? c : { ...c, values: c.values.map((v, vi) => (vi !== valueIndex ? v : value)) },
      ),
    );
  }

  function addValue(index: number) {
    onChange(conditions.map((c, i) => (i !== index ? c : { ...c, values: [...c.values, ""] })));
  }

  function removeValue(index: number, valueIndex: number) {
    onChange(
      conditions
        .map((c, i) => (i !== index ? c : { ...c, values: c.values.filter((_, vi) => vi !== valueIndex) }))
        .filter((c) => c.values.length > 0),
    );
  }

  function addCondition() {
    onChange([...conditions, { ...EMPTY_CONDITION, values: [""] }]);
  }

  function removeConditionEntry(index: number) {
    onChange(conditions.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      {conditions.map((condition, index) => (
        <div key={index} className="flex flex-col gap-2">
          {index > 0 && <p className="text-center text-xs font-semibold text-muted-foreground">AND</p>}
          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={condition.field}
                onValueChange={(value) => value && setConditionField(index, value as RuleCondition["field"])}
              >
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="subtitle">Subtitle</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={condition.operator}
                onValueChange={(value) => value && setConditionOperator(index, value)}
              >
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {condition.field === "name" ? (
                    <>
                      <SelectItem value="equals">Equals exactly</SelectItem>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="starts_with">Starts with</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="not_contains">Doesn&rsquo;t contain</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>

              {conditions.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeConditionEntry(index)}
                  aria-label="Remove condition"
                  className="ml-auto"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>

            {condition.values.map((value, valueIndex) => (
              <div key={valueIndex} className="flex items-center gap-2">
                <Input
                  value={value}
                  onChange={(e) => setConditionValue(index, valueIndex, e.target.value)}
                  placeholder="Value"
                  className="h-8 min-w-32 flex-1 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeValue(index, valueIndex)}
                  aria-label="Remove value"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => addValue(index)}>
              <Plus className="size-3.5" />
              Or value
            </Button>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" className="self-start" onClick={addCondition}>
        <Plus className="size-3.5" />
        And condition
      </Button>
    </div>
  );
}
