"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmVariant?: "default" | "destructive";
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  confirmVariant = "default",
  pending = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [internalPending, setInternalPending] = React.useState(false);
  const busy = pending || internalPending;

  async function handleConfirm() {
    setInternalPending(true);
    try {
      await onConfirm();
    } finally {
      setInternalPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter
          className={cn(
            "-mx-4 flex-row flex-wrap justify-end gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-nowrap",
          )}
        >
          <Button
            type="button"
            variant="outline"
            className="min-w-[6rem]"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant === "destructive" ? "destructive" : "default"}
            className="min-w-[6rem]"
            disabled={busy}
            onClick={() => void handleConfirm()}
          >
            {busy ? "…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
