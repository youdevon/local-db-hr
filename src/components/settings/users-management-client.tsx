"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  attachEmployeeToUserAction,
  createUserAction,
  deactivateUserAction,
  deleteUserPermanentlyAction,
  removeAttachedEmployeeFromUserAction,
  updateUserRoleAction,
} from "@/actions/users";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_USER_ROLES, type AppUserRole } from "@/lib/app-user-roles";
import type { ManagedEmployeeOption, ManagedUserRow } from "@/lib/managed-user";
import {
  notifyError,
  notifyInfo,
  notifyItemDeactivated,
  notifyItemDeleted,
  notifySuccess,
} from "@/lib/notify";
import {
  createUserFormSchema,
  type CreateUserFormFieldValues,
  type CreateUserFormInput,
} from "@/lib/validators/user";
import { formatRoleLabel, roleOptions } from "@/lib/roles";
import { cn } from "@/lib/utils";

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function isAppRole(value: string): value is AppUserRole {
  return (APP_USER_ROLES as readonly string[]).includes(value);
}

function statusBadge(user: ManagedUserRow) {
  if (user.isLocked) {
    return <StatusBadge tone="danger">Locked</StatusBadge>;
  }
  if (!user.isActive) {
    return <StatusBadge tone="muted">Inactive</StatusBadge>;
  }
  return <StatusBadge tone="success">Active</StatusBadge>;
}

const selectInputClass =
  "border-input bg-background text-foreground ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-lg border px-3 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

type UsersManagementClientProps = {
  initialUsers: ManagedUserRow[];
  currentUserId: string;
  employeeOptions: ManagedEmployeeOption[];
};

export function UsersManagementClient({
  initialUsers,
  currentUserId,
  employeeOptions,
}: UsersManagementClientProps) {
  const router = useRouter();
  const [newOpen, setNewOpen] = useState(false);
  const [roleEditUser, setRoleEditUser] = useState<ManagedUserRow | null>(null);
  const [editRoleValue, setEditRoleValue] = useState<AppUserRole>("contributor");
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleChangeReason, setRoleChangeReason] = useState("");
  const [roleChangeConfirmed, setRoleChangeConfirmed] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<ManagedUserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUserRow | null>(null);
  const [linkUser, setLinkUser] = useState<ManagedUserRow | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);
  const [removeLinkConfirmOpen, setRemoveLinkConfirmOpen] = useState(false);

  const newUserForm = useForm<CreateUserFormFieldValues, unknown, CreateUserFormInput>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "contributor",
      department: "",
      isActive: true,
      employeeId: "",
    },
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = newUserForm;

  function openRoleEdit(user: ManagedUserRow) {
    setEditRoleValue(isAppRole(user.role) ? user.role : "contributor");
    setRoleChangeReason("");
    setRoleChangeConfirmed(false);
    setRoleEditUser(user);
  }

  async function submitNewUser(values: CreateUserFormInput) {
    const result = await createUserAction(values);
    if (result.ok) {
      notifySuccess(result.message ?? "User account created successfully.");
      reset();
      setNewOpen(false);
      router.refresh();
    } else {
      notifyError(result.message ?? "User account could not be created. Please try again.");
    }
  }

  async function saveRole() {
    if (!roleEditUser) return;
    setRoleSaving(true);
    try {
      const result = await updateUserRoleAction({
        userId: roleEditUser.id,
        role: editRoleValue,
        confirmationAccepted: roleChangeConfirmed,
        reason: roleChangeReason,
      });
      if (result.ok) {
        notifySuccess(result.message ?? "Role updated successfully.");
        setRoleEditUser(null);
        router.refresh();
      } else {
        notifyError(result.message || "Failed to update user role. Please try again.");
      }
    } finally {
      setRoleSaving(false);
    }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    const result = await deactivateUserAction(deactivateTarget.id);
    if (result.ok) {
      notifyItemDeactivated("user");
      setDeactivateTarget(null);
      router.refresh();
    } else {
      notifyError(result.message || "Failed to deactivate user. Please try again.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await deleteUserPermanentlyAction(deleteTarget.id);
    if (result.ok) {
      notifyItemDeleted("user");
      setDeleteTarget(null);
      router.refresh();
    } else {
      notifyError(result.message || "Failed to delete user. Please try again.");
    }
  }

  const employeeMatches = employeeQuery.trim().length < 2
    ? []
    : employeeOptions
        .filter((option) => !option.attachedUserId || option.attachedUserId === linkUser?.id)
        .filter((option) => option.searchText.includes(employeeQuery.trim().toLowerCase()))
        .slice(0, 25);
  const selectedEmployee = employeeOptions.find((option) => option.id === selectedEmployeeId) ?? null;

  function openLinkDialog(user: ManagedUserRow) {
    setLinkUser(user);
    setAttachOpen(false);
    setEmployeeQuery("");
    setSelectedEmployeeId("");
  }

  async function saveLinkedEmployee() {
    if (!linkUser) return;
    if (!selectedEmployeeId) {
      notifyError("Please select an employee record.");
      return;
    }
    setLinkSaving(true);
    try {
      const result = await attachEmployeeToUserAction({
        userId: linkUser.id,
        employeeId: selectedEmployeeId,
      });
      if (!result.ok) {
        notifyError(result.message || "Failed to attach employee record. Please try again.");
        return;
      }
      notifySuccess(result.message);
      setAttachOpen(false);
      setLinkUser(null);
      setEmployeeQuery("");
      setSelectedEmployeeId("");
      router.refresh();
    } finally {
      setLinkSaving(false);
    }
  }

  async function removeLinkedEmployee() {
    if (!linkUser) return;
    setLinkSaving(true);
    try {
      const result = await removeAttachedEmployeeFromUserAction(linkUser.id);
      if (!result.ok) {
        notifyError(result.message || "Failed to remove employee record link. Please try again.");
        return;
      }
      notifySuccess(result.message);
      setLinkUser(null);
      setAttachOpen(false);
      setEmployeeQuery("");
      setSelectedEmployeeId("");
      router.refresh();
    } finally {
      setLinkSaving(false);
    }
  }

  const userTableColumns = useMemo<ColumnDef<ManagedUserRow>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Full name" />,
        cell: ({ row }) => <span className="font-medium">{row.original.fullName}</span>,
      },
      {
        accessorKey: "email",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
      },
      {
        accessorKey: "initials",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Initials" />,
        cell: ({ row }) => <span className="tabular-nums">{row.original.initials ?? "—"}</span>,
      },
      {
        id: "role",
        accessorFn: (row) => formatRoleLabel(row.role),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
        cell: ({ row }) => formatRoleLabel(row.original.role),
      },
      {
        accessorKey: "department",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
        cell: ({ row }) => row.original.department ?? "—",
      },
      {
        id: "linkedEmployee",
        enableSorting: false,
        header: () => (
          <span className="text-muted-foreground font-medium">Linked Employee</span>
        ),
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div
              className="flex items-center justify-between gap-2"
              onClick={(event) => event.stopPropagation()}
            >
              <span className="text-muted-foreground truncate text-xs">
                {user.linkedEmployeeName
                  ? `${user.linkedEmployeeName} (${user.linkedEmployeeFileNumber || "—"})`
                  : "—"}
              </span>
              <Button
                type="button"
                variant="outline"
                className="h-8 rounded-md px-2 text-xs"
                onClick={() => openLinkDialog(user)}
              >
                {user.employeeId ? "Change Attached Employee" : "Attach Employee"}
              </Button>
            </div>
          );
        },
      },
      {
        id: "status",
        accessorFn: (row) => (row.isLocked ? 0 : !row.isActive ? 1 : 2),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => statusBadge(row.original),
        sortingFn: (rowA, rowB) =>
          (rowA.original.isLocked ? 0 : !rowA.original.isActive ? 1 : 2) -
          (rowB.original.isLocked ? 0 : !rowB.original.isActive ? 1 : 2),
      },
      {
        accessorKey: "lastLoginAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Last login" />,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{formatDateTime(row.original.lastLoginAt)}</span>
        ),
        sortingFn: "alphanumeric",
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => (
          <span className="text-muted-foreground block text-right text-xs font-medium">Actions</span>
        ),
        cell: ({ row }) => {
          const user = row.original;
          const isSelf = user.id === currentUserId;
          return (
            <div
              className="text-right"
              onClick={(event) => event.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon-sm" }),
                    "text-muted-foreground size-8",
                  )}
                  aria-label={`Actions for ${user.fullName}`}
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-44">
                  <DropdownMenuItem onClick={() => openRoleEdit(user)}>Edit role</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openLinkDialog(user)}>
                    {user.employeeId ? "Change Attached Employee" : "Attach Employee"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      notifyInfo("Password reset is not configured yet.");
                    }}
                  >
                    Reset password
                  </DropdownMenuItem>
                  {!isSelf && user.isActive ? (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeactivateTarget(user)}
                    >
                      Deactivate user
                    </DropdownMenuItem>
                  ) : null}
                  {!isSelf ? (
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(user)}>
                      Delete permanently
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [currentUserId],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Global Settings", href: "/settings" },
          { label: "User Accounts" },
        ]}
        backFallbackHref="/settings"
        title="User Accounts"
        icon="user-cog"
        description="Create users, manage account status, and assign application roles."
        actions={
          <Button type="button" onClick={() => setNewOpen(true)}>
            <UserPlus className="size-4" aria-hidden />
            New User
          </Button>
        }
      />

      {initialUsers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No users yet"
          description="Create the first application user to get started."
          action={
            <Button type="button" onClick={() => setNewOpen(true)}>
              <UserPlus className="size-4" aria-hidden />
              New User
            </Button>
          }
        />
      ) : (
        <DataTable columns={userTableColumns} data={initialUsers} initialSorting={[]} />
      )}

      <Dialog
        open={newOpen}
        onOpenChange={(open) => {
          setNewOpen(open);
          if (!open) reset();
        }}
      >
        <DialogContent className="max-h-[min(90vh,calc(100%-2rem))] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New user</DialogTitle>
            <DialogDescription>
              Add an application account. The password is hashed on the server and never stored in plain text.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(submitNewUser)} className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="nu-fullName" className="text-sm font-medium">
                Full name
              </Label>
              <Input
                id="nu-fullName"
                className="h-10 rounded-lg text-sm"
                autoComplete="name"
                {...register("fullName")}
              />
              {errors.fullName ? (
                <p className="text-destructive text-xs">{errors.fullName.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nu-email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="nu-email"
                type="email"
                className="h-10 rounded-lg text-sm"
                autoComplete="email"
                {...register("email")}
              />
              {errors.email ? <p className="text-destructive text-xs">{errors.email.message}</p> : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nu-password" className="text-sm font-medium">
                  Password
                </Label>
                <Input
                  id="nu-password"
                  type="password"
                  className="h-10 rounded-lg text-sm"
                  autoComplete="new-password"
                  {...register("password")}
                />
                {errors.password ? (
                  <p className="text-destructive text-xs">{errors.password.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nu-confirm" className="text-sm font-medium">
                  Confirm password
                </Label>
                <Input
                  id="nu-confirm"
                  type="password"
                  className="h-10 rounded-lg text-sm"
                  autoComplete="new-password"
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword ? (
                  <p className="text-destructive text-xs">{errors.confirmPassword.message}</p>
                ) : null}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nu-role" className="text-sm font-medium">
                Role
              </Label>
              <select id="nu-role" className={selectInputClass} {...register("role")}>
                {roleOptions.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label} - {r.summary.toLowerCase()}
                  </option>
                ))}
              </select>
              {errors.role ? <p className="text-destructive text-xs">{errors.role.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nu-dept" className="text-sm font-medium">
                Department
              </Label>
              <Input
                id="nu-dept"
                className="h-10 rounded-lg text-sm"
                placeholder="Optional"
                {...register("department")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nu-employee" className="text-sm font-medium">
                Linked employee (optional)
              </Label>
              <select id="nu-employee" className={selectInputClass} {...register("employeeId")}>
                <option value="">No employee linked yet</option>
                {employeeOptions
                  .filter((option) => !option.attachedUserId)
                  .map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.fullName} ({option.fileNumber})
                    </option>
                  ))}
              </select>
              <p className="text-muted-foreground text-xs">
                Only employees not already linked to another account are listed.
              </p>
              {errors.employeeId ? (
                <p className="text-destructive text-xs">{errors.employeeId.message}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <input
                    type="checkbox"
                    id="nu-active"
                    className="border-input size-4 rounded border"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                )}
              />
              <Label htmlFor="nu-active" className="text-sm font-medium">
                Active account
              </Label>
            </div>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating…" : "Create user"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(roleEditUser)} onOpenChange={(o) => !o && setRoleEditUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit role</DialogTitle>
            <DialogDescription>
              Update the application role for {roleEditUser?.fullName ?? "this user"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-role" className="text-sm font-medium">
              Role
            </Label>
            <select
              id="edit-role"
              className={selectInputClass}
              value={editRoleValue}
              onChange={(e) => setEditRoleValue(e.target.value as AppUserRole)}
            >
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label} - {r.summary.toLowerCase()}
                </option>
              ))}
            </select>
            <div className="space-y-2 pt-2">
              <Label htmlFor="role-change-reason" className="text-sm font-medium">
                Reason for role change
              </Label>
              <Input
                id="role-change-reason"
                className="h-10 rounded-lg text-sm"
                placeholder="Enter reason"
                value={roleChangeReason}
                onChange={(e) => setRoleChangeReason(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 pt-2 text-sm font-medium">
              <input
                type="checkbox"
                className="border-input size-4 rounded border"
                checked={roleChangeConfirmed}
                onChange={(e) => setRoleChangeConfirmed(e.target.checked)}
              />
              I confirm this role change.
            </label>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setRoleEditUser(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={roleSaving} onClick={() => void saveRole()}>
              {roleSaving ? "Saving…" : "Save role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(linkUser)}
        onOpenChange={(open) => {
          if (!open) {
            setLinkUser(null);
            setAttachOpen(false);
            setEmployeeQuery("");
            setSelectedEmployeeId("");
          }
        }}
      >
        <DialogContent className="max-h-[min(90vh,calc(100%-2rem))] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Linked Employee Record</DialogTitle>
            <DialogDescription>
              Attach this user account to an employee record so the user can view their employee information on the Profile page.
            </DialogDescription>
          </DialogHeader>

          {linkUser ? (
            <div className="space-y-4">
              {linkUser.employeeId ? (
                <div className="rounded-xl border border-border bg-card p-4 text-sm">
                  <p className="font-medium">{linkUser.linkedEmployeeName || "—"}</p>
                  <p className="text-muted-foreground mt-1">File #: {linkUser.linkedEmployeeFileNumber || "—"}</p>
                  <p className="text-muted-foreground">Department: {linkUser.linkedEmployeeDepartment || "—"}</p>
                  <p className="text-muted-foreground">Position: {linkUser.linkedEmployeePosition || "—"}</p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/10 p-4 text-sm text-muted-foreground">
                  No employee record attached.
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  className="h-10 rounded-md"
                  onClick={() => setAttachOpen(true)}
                >
                  {linkUser.employeeId ? "Change Attached Employee" : "Attach Employee"}
                </Button>
                {linkUser.employeeId ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-md"
                    disabled={linkSaving}
                    onClick={() => setRemoveLinkConfirmOpen(true)}
                  >
                    Remove Employee Link
                  </Button>
                ) : null}
              </div>

              {attachOpen ? (
                <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-medium">Attach Employee Record</p>
                  <p className="text-muted-foreground text-sm">
                    Search for and select the employee record to link to this user account.
                  </p>
                  <Label className="text-sm font-medium">Employee</Label>
                  <Input
                    value={employeeQuery}
                    onChange={(event) => setEmployeeQuery(event.target.value)}
                    className="h-10 rounded-md"
                    placeholder="Search by name, file number, email, phone, or ID number"
                  />
                  {employeeMatches.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                      {employeeMatches.map((employee) => (
                        <button
                          key={employee.id}
                          type="button"
                          className={cn(
                            "hover:bg-muted/50 flex w-full items-start justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-b-0",
                            selectedEmployeeId === employee.id ? "bg-muted/40" : "",
                          )}
                          onClick={() => setSelectedEmployeeId(employee.id)}
                        >
                          <div className="min-w-0 space-y-0.5">
                            <p className="font-medium">{employee.fullName}</p>
                            <p className="text-muted-foreground truncate text-xs">
                              {employee.fileNumber} • {employee.mobileNumber} • {employee.workEmail}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {employee.department} • {employee.position}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      Enter at least 2 characters to search employees.
                    </p>
                  )}
                  {selectedEmployee ? (
                    <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
                      Selected: <span className="font-medium">{selectedEmployee.fullName}</span> ({selectedEmployee.fileNumber})
                    </div>
                  ) : null}
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" className="h-10 rounded-md" onClick={() => setAttachOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="h-10 rounded-md"
                      disabled={linkSaving || !selectedEmployeeId}
                      onClick={() => void saveLinkedEmployee()}
                    >
                      {linkSaving ? "Saving..." : linkUser.employeeId ? "Update Link" : "Attach Employee"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removeLinkConfirmOpen}
        onOpenChange={setRemoveLinkConfirmOpen}
        title="Remove Employee Link"
        description="This will unlink the employee record from this user account. The employee record will not be deleted."
        confirmLabel="Remove Employee Link"
        confirmVariant="destructive"
        pending={linkSaving}
        onConfirm={async () => {
          setRemoveLinkConfirmOpen(false);
          await removeLinkedEmployee();
        }}
      />

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title="Deactivate user?"
        description={
          deactivateTarget
            ? `Are you sure you want to deactivate ${deactivateTarget.fullName}? They will no longer be able to sign in.`
            : ""
        }
        confirmLabel="Deactivate user"
        confirmVariant="destructive"
        onConfirm={confirmDeactivate}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Permanently delete user?"
        description={
          deleteTarget
            ? `This will remove ${deleteTarget.fullName} and their profile from the database. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete user"
        confirmVariant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
