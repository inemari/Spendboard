"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { PendingRulePrompt } from "@/hooks/use-transaction-actions";

function formatNames(names: string[]): string {
  if (names.length <= 2) return names.join(" and/or ");
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function CreateRuleDialog({
  pending,
  onConfirm,
  onDismiss,
}: {
  pending: PendingRulePrompt | null;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && onDismiss()}>
      {pending && (
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create a rule?</DialogTitle>
            <DialogDescription>
              Automatically move future transactions named {formatNames(pending.rawNames)} to{" "}
              {pending.categoryName} as soon as they&rsquo;re uploaded.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={onDismiss}>
              Not now
            </Button>
            <Button onClick={onConfirm}>Create rule</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
