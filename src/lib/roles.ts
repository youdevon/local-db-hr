export const USER_ROLES = {
  administrator: {
    label: "Administrator",
    summary: "Owns the system",
    description: "Full and unrestricted access to the entire system.",
  },
  manager: {
    label: "Manager",
    summary: "Builds the records",
    description: "Creates and manages employee, contract, leave, and document records.",
  },
  contributor: {
    label: "Contributor",
    summary: "Fills in the records",
    description: "Adds and updates information on existing records.",
  },
  viewer: {
    label: "Viewer",
    summary: "Reads the records",
    description: "Read-only access to records and reports.",
  },
  member: {
    label: "Member",
    summary: "Sees only themselves",
    description: "Access to own profile only.",
  },
} as const;

export type UserRole = keyof typeof USER_ROLES;

export const roleOptions = (Object.keys(USER_ROLES) as UserRole[]).map((role) => ({
  value: role,
  label: USER_ROLES[role].label,
  summary: USER_ROLES[role].summary,
  description: USER_ROLES[role].description,
}));

const LEGACY_ROLE_MAP: Record<string, UserRole> = {
  administrator: "administrator",
  admin: "administrator",
  "hr manager": "manager",
  manager: "manager",
  "hr officer": "contributor",
  contributor: "contributor",
  auditor: "viewer",
  "read only": "viewer",
  "read-only": "viewer",
  readonly: "viewer",
  read_only: "viewer",
  "view-only": "viewer",
  viewonly: "viewer",
  viewer: "viewer",
  member: "member",
  user: "member",
};

export function normalizeUserRole(value: string | null | undefined): UserRole {
  const raw = (value ?? "").trim().toLowerCase();
  return LEGACY_ROLE_MAP[raw] ?? "member";
}

export function formatRoleLabel(value: string | null | undefined): string {
  const role = normalizeUserRole(value);
  return USER_ROLES[role].label;
}

export function hasRole(role: string | null | undefined, allowed: UserRole[]): boolean {
  return allowed.includes(normalizeUserRole(role));
}

export type Permission =
  | "settings.view"
  | "settings.edit"
  | "audit.view"
  | "audit.export"
  | "users.view"
  | "users.create"
  | "users.edit"
  | "users.delete"
  | "users.assignRole"
  | "users.attachEmployee"
  | "employees.view"
  | "employees.create"
  | "employees.edit"
  | "employees.delete"
  | "employees.export"
  | "contracts.view"
  | "contracts.create"
  | "contracts.edit"
  | "contracts.delete"
  | "contracts.export"
  | "leave.view"
  | "leave.create"
  | "leave.edit"
  | "leave.delete"
  | "leave.export"
  | "documents.view"
  | "documents.upload"
  | "documents.edit"
  | "documents.delete"
  | "reports.view"
  | "reports.export"
  | "profile.viewOwn"
  | "profile.changePassword"
  | "profile.editOwnContactDetails";

const ALL_PERMISSIONS: Permission[] = [
  "settings.view",
  "settings.edit",
  "audit.view",
  "audit.export",
  "users.view",
  "users.create",
  "users.edit",
  "users.delete",
  "users.assignRole",
  "users.attachEmployee",
  "employees.view",
  "employees.create",
  "employees.edit",
  "employees.delete",
  "employees.export",
  "contracts.view",
  "contracts.create",
  "contracts.edit",
  "contracts.delete",
  "contracts.export",
  "leave.view",
  "leave.create",
  "leave.edit",
  "leave.delete",
  "leave.export",
  "documents.view",
  "documents.upload",
  "documents.edit",
  "documents.delete",
  "reports.view",
  "reports.export",
  "profile.viewOwn",
  "profile.changePassword",
  "profile.editOwnContactDetails",
];

/**
 * Viewer is strictly read-only for HR records. Enforced here so misconfigured role sets
 * or legacy DB values cannot grant mutation permissions to viewers.
 */
const VIEWER_READ_ONLY_PERMISSIONS = new Set<Permission>([
  "employees.view",
  "contracts.view",
  "leave.view",
  "documents.view",
  "reports.view",
  "reports.export",
  "profile.viewOwn",
  "profile.changePassword",
]);

const ROLE_PERMISSIONS: Record<UserRole, Set<Permission>> = {
  administrator: new Set(ALL_PERMISSIONS),
  manager: new Set([
    "employees.view",
    "employees.create",
    "employees.edit",
    "employees.export",
    "contracts.view",
    "contracts.create",
    "contracts.edit",
    "contracts.export",
    "leave.view",
    "leave.create",
    "leave.edit",
    "leave.delete",
    "leave.export",
    "documents.view",
    "documents.upload",
    "documents.edit",
    "documents.delete",
    "reports.view",
    "reports.export",
    "profile.viewOwn",
    "profile.changePassword",
  ]),
  contributor: new Set([
    "employees.view",
    "employees.edit",
    "contracts.view",
    "contracts.edit",
    "leave.view",
    "leave.create",
    "leave.edit",
    "documents.view",
    "documents.upload",
    "documents.edit",
    "reports.view",
    "profile.viewOwn",
    "profile.changePassword",
  ]),
  viewer: new Set([
    "employees.view",
    "contracts.view",
    "leave.view",
    "documents.view",
    "reports.view",
    "reports.export",
    "profile.viewOwn",
    "profile.changePassword",
  ]),
  member: new Set(["profile.viewOwn", "profile.changePassword"]),
};

export function canPerformAction(roleInput: string | null | undefined, permission: Permission): boolean {
  const role = normalizeUserRole(roleInput);
  if (role === "viewer") {
    return VIEWER_READ_ONLY_PERMISSIONS.has(permission);
  }
  return ROLE_PERMISSIONS[role].has(permission);
}

/** Shown when a viewer attempts a blocked mutation (UI or API). */
export const MUTATION_NOT_PERMITTED_MESSAGE = "You do not have permission to make changes.";

/** Query param for flash messages after redirecting viewers away from write routes. */
export const VIEWER_NOTICE_PARAM = "viewerNotice";

export const VIEWER_NOTICE_NO_CREATE_EMPLOYEES = "no_create_employees";
export const VIEWER_NOTICE_NO_EDIT_EMPLOYEES = "no_edit_employees";

/** Standard query for redirecting viewers away from employee write routes. */
export const VIEW_ONLY_ERROR_PARAM = "error";
export const VIEW_ONLY_ERROR_VALUE = "view-only";

export const VIEW_ONLY_CANNOT_EDIT_EMPLOYEE_MESSAGE =
  "You have view-only access and cannot edit employee records.";

export const VIEW_ONLY_CANNOT_CREATE_EMPLOYEE_MESSAGE =
  "You have view-only access and cannot create employee records.";

/** Toast copy when a viewer hits a blocked non-employee write route (contracts, leave, etc.). */
export const VIEW_ONLY_CANNOT_MUTATE_HR_MESSAGE =
  "You have view-only access and cannot make changes.";

export const VIEWER_NOTICE_MESSAGES: Record<string, string> = {
  [VIEWER_NOTICE_NO_CREATE_EMPLOYEES]: "You have view-only access and cannot create employees.",
  [VIEWER_NOTICE_NO_EDIT_EMPLOYEES]: "You have view-only access and cannot edit employees.",
};

export function isViewerRole(roleInput: string | null | undefined): boolean {
  return normalizeUserRole(roleInput) === "viewer";
}

/** @see isViewerRole — short name for templates and route guards. */
export function isViewer(roleInput: string | null | undefined): boolean {
  return isViewerRole(roleInput);
}

/** Dashboard and HR list/detail areas (excludes member self-service scope). */
export function canView(roleInput: string | null | undefined): boolean {
  return normalizeUserRole(roleInput) !== "member";
}

export function canExportReports(roleInput: string | null | undefined): boolean {
  return canPerformAction(roleInput, "reports.export");
}

/** Any create-style permission (HR records or user admin). */
export function canCreate(roleInput: string | null | undefined): boolean {
  if (isViewerRole(roleInput)) return false;
  return (
    canPerformAction(roleInput, "contracts.create") ||
    canPerformAction(roleInput, "employees.create") ||
    canPerformAction(roleInput, "leave.create") ||
    canPerformAction(roleInput, "users.create")
  );
}

/** Any edit-style permission (HR records, documents, settings, or user admin). */
export function canEdit(roleInput: string | null | undefined): boolean {
  if (isViewerRole(roleInput)) return false;
  return (
    canPerformAction(roleInput, "contracts.edit") ||
    canPerformAction(roleInput, "employees.edit") ||
    canPerformAction(roleInput, "leave.edit") ||
    canPerformAction(roleInput, "documents.edit") ||
    canPerformAction(roleInput, "users.edit") ||
    canPerformAction(roleInput, "settings.edit")
  );
}

/** Any delete-style permission. */
export function canDelete(roleInput: string | null | undefined): boolean {
  if (isViewerRole(roleInput)) return false;
  return (
    canPerformAction(roleInput, "contracts.delete") ||
    canPerformAction(roleInput, "employees.delete") ||
    canPerformAction(roleInput, "leave.delete") ||
    canPerformAction(roleInput, "documents.delete") ||
    canPerformAction(roleInput, "users.delete")
  );
}

export function canCreateEmployees(roleInput: string | null | undefined): boolean {
  return !isViewerRole(roleInput) && canPerformAction(roleInput, "employees.create");
}

export function canEditEmployees(roleInput: string | null | undefined): boolean {
  return !isViewerRole(roleInput) && canPerformAction(roleInput, "employees.edit");
}

/**
 * Operational HR data changes (not member profile-only flows).
 * Viewers cannot mutate; members are out of scope for these server paths.
 */
export function canMutate(roleInput: string | null | undefined): boolean {
  const role = normalizeUserRole(roleInput);
  return role !== "viewer" && role !== "member";
}

function normalizePathname(pathname: string): string {
  const path = pathname.split("?")[0] || pathname;
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

/**
 * When a viewer requests a write-only path, return a safe URL with `error=view-only`, or `null` to use `/unauthorized`.
 */
export function viewerWriteBlockedRedirectTarget(pathname: string): string | null {
  const path = normalizePathname(pathname);
  const q = `${VIEW_ONLY_ERROR_PARAM}=${VIEW_ONLY_ERROR_VALUE}`;
  if (path === "/employees/new") return `/employees?${q}`;
  const em = path.match(/^\/employees\/([^/]+)\/edit$/);
  if (em) return `/employees/${em[1]}?${q}`;
  if (path === "/contracts/new") return `/contracts?${q}`;
  const cm = path.match(/^\/contracts\/([^/]+)\/edit$/);
  if (cm) return `/contracts/${cm[1]}?${q}`;
  if (path === "/leave/new") return `/leave?${q}`;
  if (/\/leave\/transactions\/[^/]+\/edit$/.test(path)) return `/leave?${q}`;
  return null;
}

export function canAccessRoute(roleInput: string | null | undefined, pathname: string): boolean {
  const role = normalizeUserRole(roleInput);
  const path = normalizePathname(pathname);

  if (path === "/profile" || path.startsWith("/profile/")) return true;
  if (path === "/dashboard" || path.startsWith("/dashboard/")) return role !== "member";
  if (path === "/" || path.startsWith("/unauthorized")) return role !== "member";
  if (path.startsWith("/audit")) return role === "administrator";
  if (path.startsWith("/settings") || path.startsWith("/global-settings")) return role === "administrator";
  if (path.startsWith("/reports")) return canPerformAction(role, "reports.view");

  if (path.startsWith("/employees")) {
    if (!canPerformAction(role, "employees.view")) return false;
    if (path === "/employees/new") return canPerformAction(role, "employees.create");
    if (/\/employees\/[^/]+\/edit$/.test(path)) return canPerformAction(role, "employees.edit");
    return true;
  }

  if (path.startsWith("/contracts")) {
    if (!canPerformAction(role, "contracts.view")) return false;
    if (path === "/contracts/new") return canPerformAction(role, "contracts.create");
    if (/\/contracts\/[^/]+\/edit$/.test(path)) return canPerformAction(role, "contracts.edit");
    return true;
  }

  if (path.startsWith("/leave")) {
    if (!canPerformAction(role, "leave.view")) return false;
    if (path === "/leave/new") return canPerformAction(role, "leave.create");
    if (/\/leave\/transactions\/[^/]+\/edit$/.test(path)) return canPerformAction(role, "leave.edit");
    return true;
  }

  return role === "administrator";
}

/** Where to send a user who cannot use a write-only route (viewer → safe list/detail). */
export function redirectTargetForDeniedWriteRoute(role: UserRole, fallbackHref: string): string {
  if (role === "member") return "/profile";
  if (role === "viewer") return fallbackHref;
  return "/unauthorized";
}
