import type { UserRole } from "@/lib/roles";

export const APP_USER_ROLES = [
  "administrator",
  "manager",
  "contributor",
  "viewer",
  "member",
] as const;

export type AppUserRole = UserRole;
