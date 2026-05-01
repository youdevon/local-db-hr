"use client";

import { LogOut } from "lucide-react";

import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <form action={logoutAction} className="shrink-0">
      <Button
        type="submit"
        variant="outline"
        size="icon"
        className="h-10 w-10 rounded-md"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="size-4" />
      </Button>
    </form>
  );
}
