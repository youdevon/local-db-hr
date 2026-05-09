"use client";

import { useActionState, useEffect } from "react";

import { loginAction, type LoginActionState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifyError, notifyInfo } from "@/lib/notify";
import type { LoginNoticeSettings } from "@/lib/security-settings";
import { cn } from "@/lib/utils";

const initialState: LoginActionState = {};
const STALE_AUTH_KEYS = [
  "sessionExpired",
  "logoutReason",
  "inactivityTimeout",
  "authExpired",
  "sessionTimedOut",
  "reason",
  "local_db_hr_logout_broadcast",
  "local_db_hr_timeout_logout_sent",
] as const;

function clearStaleAuthState() {
  for (const key of STALE_AUTH_KEYS) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
}

export function LoginForm({ loginNoticeSettings }: { loginNoticeSettings: LoginNoticeSettings }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  useEffect(() => {
    if (state.error) {
      notifyError(state.error);
    }
  }, [state.error]);

  useEffect(() => {
    clearStaleAuthState();
  }, []);

  return (
    <div
      className={cn(
        "border-border bg-card w-full rounded-xl border p-8 shadow-xl ring-1 ring-foreground/5",
        "shadow-slate-200/80 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-black/40",
      )}
    >
      <form action={formAction} className="space-y-5" onSubmit={() => clearStaleAuthState()}>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="bg-background border-border h-11 rounded-md px-3 text-sm shadow-xs dark:bg-input/30"
            placeholder="Email Address"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium">
            Password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="bg-background border-border h-11 rounded-md px-3 text-sm shadow-xs dark:bg-input/30"
            placeholder="Password"
          />
        </div>
        {loginNoticeSettings.enabled ? (
          <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-900/60 dark:bg-amber-950/30">
            <p className="text-sm text-amber-900 dark:text-amber-100">{loginNoticeSettings.noticeText}</p>
            {loginNoticeSettings.requireAcknowledgement ? (
              <label className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-100">
                <input
                  type="checkbox"
                  name="acknowledgeLoginNotice"
                  className="size-4 rounded border border-amber-300"
                />
                I acknowledge this notice
              </label>
            ) : null}
          </div>
        ) : null}
        <Button type="submit" className="h-11 w-full text-sm font-medium" disabled={pending}>
          {pending ? "Signing in…" : "Sign In"}
        </Button>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground w-full text-center text-sm underline-offset-4 transition-colors hover:underline"
          onClick={() => notifyInfo("Password reset is not configured yet.")}
        >
          Forgot password?
        </button>
      </form>
    </div>
  );
}
