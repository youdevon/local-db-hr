"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { changeOwnPasswordAction } from "@/actions/users";
import { SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifyError, notifySuccess } from "@/lib/notify";
import { changeOwnPasswordSchema, type ChangeOwnPasswordInput } from "@/lib/validators/user";

type ProfileAccountCardProps = {
  fullName: string;
  email: string;
  role: string;
  department: string | null;
  lastLoginIp: string | null;
  lastLoginDevice: string | null;
};

function Value({ value }: { value: string | null | undefined }) {
  const safe = value?.trim();
  return <dd className="text-foreground text-sm font-medium">{safe || "—"}</dd>;
}

export function ProfileAccountCard({
  fullName,
  email,
  role,
  department,
  lastLoginIp,
  lastLoginDevice,
}: ProfileAccountCardProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<ChangeOwnPasswordInput>({
    resolver: zodResolver(changeOwnPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  async function onSubmit(values: ChangeOwnPasswordInput) {
    const result = await changeOwnPasswordAction(values);
    if (result.success) {
      notifySuccess(result.message);
      setOpen(false);
      reset();
      return;
    }
    notifyError(result.message);
  }

  function onInvalidSubmit() {
    if (errors.newPassword?.message?.includes("at least 8")) {
      notifyError("Password must be at least 8 characters.");
      return;
    }
    if (errors.confirmNewPassword?.message?.includes("match")) {
      notifyError("Passwords do not match.");
      return;
    }
    notifyError("Failed to change password. Please try again.");
  }

  return (
    <>
      <SectionCard
        title="Account Information"
        headerActions={
          <Button type="button" className="h-10 rounded-md" onClick={() => setOpen(true)}>
            Change Password
          </Button>
        }
      >
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs font-medium">Full name</dt>
            <Value value={fullName} />
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs font-medium">Email</dt>
            <Value value={email} />
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs font-medium">Role</dt>
            <Value value={role} />
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs font-medium">Department</dt>
            <Value value={department} />
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs font-medium">Last login IP</dt>
            <Value value={lastLoginIp} />
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs font-medium">Last login device</dt>
            <Value value={lastLoginDevice} />
          </div>
        </dl>
      </SectionCard>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) reset();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Enter and confirm your new password.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit, onInvalidSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                className="h-10 rounded-md"
                {...register("newPassword")}
              />
              {errors.newPassword ? (
                <p className="text-destructive text-xs">{errors.newPassword.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirm New Password</Label>
              <Input
                id="confirm-new-password"
                type="password"
                autoComplete="new-password"
                className="h-10 rounded-md"
                {...register("confirmNewPassword")}
              />
              {errors.confirmNewPassword ? (
                <p className="text-destructive text-xs">{errors.confirmNewPassword.message}</p>
              ) : null}
            </div>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="secondary" className="h-10 rounded-md" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="h-10 rounded-md" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
