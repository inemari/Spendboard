"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

export function CategoryDropZone({ id, name }: { id: string; name: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-24 items-center justify-center rounded-xl border-2 border-dashed p-4 text-center text-sm font-medium transition-colors",
        isOver ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
      )}
    >
      {name}
    </div>
  );
}
