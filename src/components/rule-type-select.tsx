"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatTxType } from "@/lib/format";
import type { TxType } from "@/lib/types";

const NO_TYPE_VALUE = "__no_type__";
const TYPES: TxType[] = ["personal", "common", "need_review"];

/**
 * The one place a rule's optional "also set type" effect is picked, shared
 * by the quick-add form, the rule editor, and the admin template editor so
 * the wording/options can't drift between them (same precedent as
 * `category-create-fields.tsx` for the category-creation fields).
 */
export function RuleTypeSelect({
  value,
  onChange,
  className,
}: {
  value: TxType | null;
  onChange: (type: TxType | null) => void;
  className?: string;
}) {
  return (
    <Select
      value={value ?? NO_TYPE_VALUE}
      onValueChange={(v) => onChange(v === NO_TYPE_VALUE ? null : (v as TxType))}
    >
      <SelectTrigger className={className ?? "h-9 w-full"}>
        <SelectValue>{value ? `Also set ${formatTxType(value)}` : "Don't set type"}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_TYPE_VALUE}>Don&rsquo;t set type</SelectItem>
        {TYPES.map((type) => (
          <SelectItem key={type} value={type}>
            Also set {formatTxType(type)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
