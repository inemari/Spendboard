"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { PendingDelete } from "@/hooks/use-transaction-actions";

export function DeleteConfirmDialog({
  pending,
  onConfirm,
  onDismiss,
}: {
  pending: PendingDelete | null;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <AlertDialog open={pending !== null} onOpenChange={(open) => !open && onDismiss()}>
      {pending && (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending.ids.length === 1
                ? "Delete this transaction?"
                : `Delete ${pending.ids.length} transactions?`}
            </AlertDialogTitle>
            <AlertDialogDescription>This can&rsquo;t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onConfirm}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );
}
