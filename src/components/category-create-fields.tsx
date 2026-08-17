"use client";

import type { Ref } from "react";
import { CategoryIconPicker } from "@/components/category-icon-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Shared across every "create a category" entry point (the Categories
 *  screen's panel, the admin default-categories panel, and the Categorize
 *  screen's popover) so picking "no parent" reads the same everywhere. */
export const NO_PARENT_VALUE = "__none__";

/**
 * The icon + name + parent fields shared by every category-creation surface
 * in the app. Deliberately just the fields, not the submit button or
 * container: each caller wraps this in whatever chrome fits its screen (an
 * inline card panel, a popover), since those differ, but the fields
 * themselves — labels, wording, layout — must not drift between them.
 */
export function CategoryCreateFields({
  idPrefix,
  icon,
  onIconChange,
  name,
  onNameChange,
  onNameEnter,
  nameInputRef,
  autoFocusName,
  parentId,
  onParentIdChange,
  parentOptions,
  layout = "row",
}: {
  /** Namespaces the field ids so multiple instances can exist on one page. */
  idPrefix: string;
  icon: string | null;
  onIconChange: (icon: string | null) => void;
  name: string;
  onNameChange: (name: string) => void;
  /** Fired on Enter in the name field — callers wire this to their submit. */
  onNameEnter?: () => void;
  nameInputRef?: Ref<HTMLInputElement>;
  /** For a popover that mounts fresh each time it opens — an inline panel
   *  that stays mounted focuses imperatively via `nameInputRef` instead. */
  autoFocusName?: boolean;
  parentId: string;
  onParentIdChange: (parentId: string) => void;
  /** Top-level categories a new one can nest under. */
  parentOptions: { id: string; name: string }[];
  /** "row" (default) puts icon/Name/Parent side by side above the `sm`
   *  breakpoint — right for the Categories/admin panels, which are as wide
   *  as their page. That breakpoint is a *viewport* width, though, not a
   *  container one: inside a fixed-width popover (the Categorize screen's,
   *  `w-80`) on any normal desktop viewport it still fires, squeezing Name
   *  and a ~14rem Parent select into 320px total. "compact" keeps icon+Name
   *  on one line always and puts Parent on its own full-width line below,
   *  regardless of viewport — for exactly that kind of narrow, fixed-width
   *  container. */
  layout?: "row" | "compact";
}) {
  const nameFieldId = `${idPrefix}-name`;
  const parentFieldId = `${idPrefix}-parent`;

  const nameField = (
    <div className="flex flex-1 flex-col gap-1">
      <Label htmlFor={nameFieldId}>Name</Label>
      <Input
        id={nameFieldId}
        ref={nameInputRef}
        autoFocus={autoFocusName}
        placeholder="Category name"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onNameEnter?.();
        }}
        className="h-9"
      />
    </div>
  );

  const parentField = (
    <div className={cn("flex flex-col gap-1", layout === "row" && "sm:w-56")}>
      <Label htmlFor={parentFieldId}>Parent</Label>
      <Select value={parentId} onValueChange={(value) => onParentIdChange(value ?? NO_PARENT_VALUE)}>
        <SelectTrigger id={parentFieldId} className="h-9 w-full">
          <SelectValue placeholder="Parent category">
            {parentId === NO_PARENT_VALUE
              ? "No parent"
              : parentOptions.find((c) => c.id === parentId)?.name}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_PARENT_VALUE}>No parent (top-level category)</SelectItem>
          {parentOptions.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  if (layout === "compact") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <CategoryIconPicker value={icon} name={name} onChange={onIconChange} className="size-9" />
          {nameField}
        </div>
        {parentField}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <CategoryIconPicker value={icon} name={name} onChange={onIconChange} className="size-9" />
      {nameField}
      {parentField}
    </div>
  );
}
