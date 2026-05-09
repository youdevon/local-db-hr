"use client";

import { Fragment, useState } from "react";

import { ProfilePersonalInfoForm, type ProfilePersonalInfo } from "@/components/profile/profile-personal-info-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ProfileUpdatePersonalDialogProps = {
  initialValues: ProfilePersonalInfo;
  className?: string;
};

export function ProfileUpdatePersonalDialog({ initialValues, className }: ProfileUpdatePersonalDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Fragment>
      <Button
        type="button"
        variant="outline"
        className={cn("h-10 rounded-md text-sm font-medium", className)}
        onClick={() => setOpen(true)}
      >
        Update Personal Information
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton
          className={cn(
            "flex h-[min(92vh,880px)] max-h-[92vh] w-[calc(100%-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl",
          )}
        >
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4 text-left">
            <DialogTitle>Update personal information</DialogTitle>
          </DialogHeader>
          <ProfilePersonalInfoForm
            initialValues={initialValues}
            showSectionCard={false}
            variant="dialog"
            onSaved={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </Fragment>
  );
}
