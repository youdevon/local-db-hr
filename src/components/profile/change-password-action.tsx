"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { changeOwnPasswordAction } from "@/actions/users";
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

export function ChangePasswordAction({
  requirePasswordChange = false,
}: {
  requirePasswordChange?: boolean;
}) {
  const router = useRouter();
  const [manualOpen, setManualOpen] = useState(false);
  const open = requirePasswordChange || manualOpen;
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
    if (!result.success) {
      notifyError(result.message || "Failed to change password. Please try again.");
      return;
    }
    notifySuccess("Password changed successfully.");
    setManualOpen(false);
    reset();
    router.refresh();
    if (requirePasswordChange) {
      router.replace("/profile");
    }
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
      {!requirePasswordChange ? (
        <Button type="button" className="h-10 rounded-md text-sm font-medium" onClick={() => setManualOpen(true)}>
          Change Password
        </Button>
      ) : null}
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (requirePasswordChange && !nextOpen) return;
          setManualOpen(nextOpen);
          if (!nextOpen) reset();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{requirePasswordChange ? "Change Required Password" : "Change Password"}</DialogTitle>
            <DialogDescription>
              {requirePasswordChange
                ? "Your account is using temporary setup credentials. Choose a new password before continuing."
                : "Enter and confirm your new password."}
            </DialogDescription>
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
              {!requirePasswordChange ? (
                <Button type="button" variant="secondary" className="h-10 rounded-md" onClick={() => setManualOpen(false)}>
                  Cancel
                </Button>
              ) : null}
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
