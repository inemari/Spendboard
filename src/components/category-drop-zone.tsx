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
        "flex items-center justify-center rounded-xl border-dashed text-center transition-colors",
        variant === "parent" ? "h-32 border-2 p-4 text-base font-semibold" : "h-20 border p-2 text-sm font-medium",
        isOver
          ? "border-primary bg-primary/10 text-primary"
          : variant === "parent"
            ? "border-border text-foreground"
            : "border-border/60 text-muted-foreground",
      )}
    >
      {name}
    </div>
  );
}
