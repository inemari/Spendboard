"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CATEGORY_ICON_GROUPS,
  categoryIcon,
  guessCategoryIconKey,
  iconForKey,
} from "@/lib/category-icons";
import { cn } from "@/lib/utils";

/**
 * Pick the icon a category wears in the overview sidebar.
 *
 * The first cell is "Automatic" (a null icon), not a blank one: a category
 * with no icon still renders one guessed from its name, so "no choice" is a
 * real, useful state rather than an empty circle — which is also why the
 * trigger and that cell both preview whatever the guess currently resolves to.
 */
/** Renders a resolved icon component. A wrapper rather than
 *  `<Current … />` on a local because the lucide component is looked up at
 *  render time from the saved slug, and a capitalized local holding it reads
 *  to React's lint rules as a component declared during render. */
function IconGlyph({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return <Icon className={className} />;
}

export function CategoryIconPicker({
  value,
  name,
  onChange,
  disabled,
  className,
}: {
  value: string | null;
  /** The category's name, used to preview what "Automatic" would resolve to. */
  name: string;
  onChange: (icon: string | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = categoryIcon(value, name);
  const autoPreview = categoryIcon(null, name);
  const autoKey = guessCategoryIconKey(name);

  function select(icon: string | null) {
    onChange(icon);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={disabled}
        aria-label="Choose an icon"
        title="Choose an icon"
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-muted disabled:opacity-50",
          className,
        )}
      >
        <IconGlyph icon={current} className={cn("size-4", !value && "text-muted-foreground")} />
      </PopoverTrigger>

      <PopoverContent align="start" className="max-h-80 w-72 overflow-y-auto">
        <button
          type="button"
          onClick={() => select(null)}
          className={cn(
            "mb-2 flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors",
            value === null ? "border-primary ring-1 ring-primary" : "border-border hover:bg-muted",
          )}
        >
          <IconGlyph icon={autoPreview} className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            Automatic
            <span className="ml-1 text-muted-foreground">
              {autoKey ? "(from the name)" : "(no match yet)"}
            </span>
          </span>
        </button>

        {CATEGORY_ICON_GROUPS.map((group) => (
          <div key={group.label} className="mb-2 last:mb-0">
            <p className="px-1 pb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              {group.label}
            </p>
            <div className="grid grid-cols-8 gap-0.5">
              {group.keys.map((key) => {
                const icon = iconForKey(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => select(key)}
                    aria-label={key}
                    title={key}
                    className={cn(
                      "grid size-8 place-items-center rounded-lg transition-colors",
                      value === key
                        ? "bg-primary/10 text-primary ring-1 ring-primary"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    <IconGlyph icon={icon} className="size-4" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
