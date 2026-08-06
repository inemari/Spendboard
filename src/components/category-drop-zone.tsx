"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

export function CategoryDropZone({
  id,
  name,
  variant = "parent",
}: {
  id: string;
  name: string;
  variant?: "parent" | "sub";
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center justify-center rounded-md border-dashed text-center transition-colors w-full",
        variant === "parent"
          ? " border-2 p-2 text-sm font-semibold h-full"
          : "h-10 border p-1 text-xs font-medium",
        isOver
          ? "border-primary bg-primary/10 text-primary"
          : variant === "parent"
            ? "border-none text-foreground"
            : "border-border text-foreground/80",
      )}
    >
      {name}
    </div>
  );
}
