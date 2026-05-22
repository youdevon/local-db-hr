"use server";

import { Prisma } from "@prisma/client";
import { getIronSession } from "iron-session";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { createLoginAuditLog, createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";
import { requirePermission, requireSessionUserId } from "@/lib/auth-server";
import { sendHrNotification } from "@/lib/email/hr-notifications";
import { buildSimpleHrTemplate } from "@/lib/email/templates";
import { prisma } from "@/lib/prisma";
import { normalizeUserRole } from "@/lib/roles";
import {
  getPasswordPolicySettings,
  getRoleSafetySettings,
  validatePasswordAgainstPolicy,
} from "@/lib/security-settings";
import { sessionOptions, type SessionData } from "@/lib/session";
import { initialsFromFullName } from "@/lib/user-initials";
import {
  changeOwnPasswordSchema,
  createUserFormSchema,
  updateUserRoleSchema,
} from "@/lib/validators/user";

export type UserMutationResult =
  | { ok: true; success?: true; message?: string }
  | { ok: false; success?: false; message?: string };
export type PasswordChangeResult =
  | { success: true; message: "Password changed successfully." }
  | { success: false; message: string };
export type UserEmployeeLinkResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

function revalidateUsers() {
  revalidatePath("/settings/users");
}

async function isLastActiveAdministrator(userId: string): Promise<boolean> {
  const row = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS count
    FROM public.users u
    JOIN public.user_profiles p ON p.user_id = u.id
    WHERE u.is_active = true
      AND lower(p.role) = 'administrator'
  `);
  const activeAdminCount = row[0]?.count ?? 0;
  if (activeAdminCount !== 1) return false;

  const target = await prisma.$queryRaw<Array<{ role: string | null }>>(Prisma.sql`
    SELECT p.role::text AS role
    FROM public.user_profiles p
    WHERE p.user_id = ${userId}::uuid
    LIMIT 1
  `);
  return normalizeUserRole(target[0]?.role) === "administrator";
}

function buildUserAuditDisplayName(row: {
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
}): string {
  const first = row.first_name?.trim() || "";
  const last = row.last_name?.trim() || "";
  const employeeName = [first, last].filter(Boolean).join(" ");
  if (employeeName) return employeeName;
  if (row.full_name?.trim()) return row.full_name.trim();
  if (row.email?.trim()) return row.email.trim();
  return "Unknown";
}

async function resolveUserAuditTargetLabel(userId: string | null | undefined): Promise<string> {
  const id = userId?.trim();
  if (!id) return "User: Unknown";

  const rows = await prisma.$queryRaw<
    Array<{
      email: string | null;
      full_name: string | null;
      first_name: string | null;
      last_name: string | null;
    }>
  >(Prisma.sql`
    SELECT
      u.email,
      p.full_name,
      e.first_name,
      e.last_name
    FROM public.users u
    LEFT JOIN public.user_profiles p
      ON p.user_id = u.id
    LEFT JOIN public.employees e
      ON e.id = p.employee_id
    WHERE u.id = ${id}::uuid
    LIMIT 1
  `);

  const row = rows[0];
  if (!row) return "User: Unknown";
  return `User: ${buildUserAuditDisplayName(row)}`;
}

function safeCreateUserMessageForClient(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = error.meta?.target;
      const targetStr = Array.isArray(target) ? target.join(" ") : String(target ?? "");
      const lowerTarget = targetStr.toLowerCase();
      if (lowerTarget.includes("employee_id") || lowerTarget.includes("unique_user_profile_employee")) {
        return "The selected employee is already linked to another user account.";
      }
      return "A user with this email already exists.";
    }
  }
  const text = error instanceof Error ? error.message : String(error);
  if (text === "EMPLOYEE_ALREADY_LINKED") {
    return "The selected employee is already linked to another user account.";
  }
  const lower = text.toLowerCase();
  if (
    lower.includes("unique constraint") ||
    lower.includes("duplicate key") ||
    lower.includes("already exists") ||
    lower.includes("users_email") ||
    lower.includes("users_email_key")
  ) {
    return "A user with this email already exists.";
  }
  if (
    lower.includes("unique_user_profile_employee") ||
    (lower.includes("employee_id") && lower.includes("unique"))
  ) {
    return "The selected employee is already linked to another user account.";
  }
  if (lower.includes("user_profiles_role_check") || (lower.includes("role") && lower.includes("check constraint"))) {
    return "Please select a valid user role.";
  }
  if (lower.includes("violates check constraint")) {
    return "User account could not be created because a required field did not meet requirements.";
  }
  if (lower.includes("permission denied") || lower.includes("row-level security")) {
    return "User account could not be created. Please try again.";
  }
  if (lower.includes("gen_salt") || lower.includes("pgcrypto") || lower.includes("crypt(")) {
    return "User account could not be created. Please try again.";
  }
  return "User account could not be created. Please try again.";
}

export async function createUserAction(input: unknown): Promise<UserMutationResult> {
  const auth = await requirePermission("users.create");
  if (!auth?.userId) {
    return { ok: false, success: false, message: "You do not have permission to create user accounts." };
  }
  if (normalizeUserRole(auth.role) !== "administrator") {
    return { ok: false, success: false, message: "You do not have permission to create user accounts." };
  }
  const actorId = auth.userId;
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  const parsed = createUserFormSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message;
    return {
      ok: false,
      success: false,
      message: first || "Please complete all required fields.",
    };
  }

  const { fullName, email, password, role, department, isActive, employeeId } = parsed.data;

  const passwordPolicy = await getPasswordPolicySettings();
  const passwordIssue = validatePasswordAgainstPolicy(password, passwordPolicy);
  if (passwordIssue) {
    return { ok: false, success: false, message: passwordIssue };
  }
  const emailNorm = email;
  const fullNameTrimmed = fullName.trim();
  const createdUserTargetLabel = `User: ${fullNameTrimmed || emailNorm}`;
  const initials = initialsFromFullName(fullName);
  const dept = department?.trim() ? department.trim() : null;

  const duplicate = await prisma.user.findUnique({
    where: { email: emailNorm },
    select: { id: true },
  });
  if (duplicate) {
    await createSystemAuditLog({
      actorUserId: actorId,
      module: "User Accounts",
      action: "created_user",
      targetType: "user",
      targetLabel: createdUserTargetLabel,
      success: false,
      failureReason: "A user with this email already exists.",
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { ok: false, success: false, message: "A user with this email already exists." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const inserted = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
          INSERT INTO public.users (email, password_hash, is_active, is_locked, failed_login_attempts)
          VALUES (
            ${emailNorm}::text,
            crypt(${password}::text, gen_salt('bf')),
            ${isActive},
            false,
            0
          )
          RETURNING id::text AS id
        `,
      );
      const id = inserted[0]?.id;
      if (!id) throw new Error("missing user id");

      await tx.userProfile.create({
        data: {
          user_id: id,
          full_name: fullName.trim(),
          initials,
          role,
          department: dept,
        },
      });

      if (employeeId) {
        const existingLink = await tx.userProfile.findFirst({
          where: { employee_id: employeeId },
          select: { user_id: true },
        });
        if (existingLink) {
          throw new Error("EMPLOYEE_ALREADY_LINKED");
        }
        await tx.userProfile.update({
          where: { user_id: id },
          data: { employee_id: employeeId },
        });
      }
    });
    revalidateUsers();
    await createSystemAuditLog({
      actorUserId: actorId,
      module: "User Accounts",
      action: "created_user",
      targetType: "user",
      targetLabel: createdUserTargetLabel,
      success: true,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    await sendHrNotification({
      notificationType: "user_created",
      settingKey: "sendSecurityAdminAlerts",
      recipientMode: "hr_only",
      subject: "User Account Created",
      text: buildSimpleHrTemplate({
        lines: [`A user account was created for ${emailNorm}.`, `Role: ${role}`],
      }),
      metadata: { email: emailNorm, role },
    });
    return { ok: true, success: true, message: "User account created successfully." };
  } catch (e) {
    const clientMessage = safeCreateUserMessageForClient(e);
    console.error("[createUserAction] failed", {
      email: emailNorm,
      role,
      employeeId: employeeId ?? null,
      message: e instanceof Error ? e.message : String(e),
    });
    await createSystemAuditLog({
      actorUserId: actorId,
      module: "User Accounts",
      action: "created_user",
      targetType: "user",
      targetLabel: createdUserTargetLabel,
      success: false,
      failureReason: clientMessage,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { ok: false, success: false, message: clientMessage };
  }
}

export async function updateUserRoleAction(input: unknown): Promise<UserMutationResult> {
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  const parsed = updateUserRoleSchema.safeParse(input);
  if (!parsed.success) {
    const roleIssue = parsed.error.issues.some((issue) => issue.path[0] === "role");
    return {
      ok: false,
      message: roleIssue ? "Please select a valid user role." : "Invalid request.",
    };
  }

  const { userId, role, confirmationAccepted, reason } = parsed.data;
  const targetLabel = await resolveUserAuditTargetLabel(userId);
  const roleSafetySettings = await getRoleSafetySettings();

  const actorId = await requireSessionUserId();

  const actorRows = await prisma.$queryRaw<Array<{ role: string | null }>>(
    Prisma.sql`
      SELECT role::text AS role
      FROM public.user_profiles
      WHERE user_id = ${actorId}::uuid
      LIMIT 1
    `,
  );
  const actorDbRole = normalizeUserRole(actorRows[0]?.role ?? null);
  if (actorDbRole !== "administrator") {
    await createSystemAuditLog({
      actorUserId: actorId,
      module: "User Accounts",
      action: "changed_user_role",
      targetType: "user",
      targetId: userId,
      targetLabel,
      success: false,
      failureReason: "You do not have permission to change user roles.",
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { ok: false, message: "You do not have permission to change user roles." };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      profile: { select: { role: true } },
    },
  });

  if (!target?.email) {
    await createSystemAuditLog({
      actorUserId: actorId,
      module: "User Accounts",
      action: "changed_user_role",
      targetType: "user",
      targetId: userId,
      targetLabel,
      success: false,
      failureReason: "User account not found.",
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { ok: false, message: "Failed to update role. Please try again." };
  }

  const beforeRoleRaw = target.profile?.role ?? null;
  const beforeNorm = normalizeUserRole(beforeRoleRaw);
  const afterNorm = normalizeUserRole(role);

  if (roleSafetySettings.requireRoleChangeConfirmation && confirmationAccepted !== true) {
    return { ok: false, message: "Role change confirmation is required." };
  }
  if (roleSafetySettings.requirePermissionChangeReason && !reason?.trim()) {
    return { ok: false, message: "A reason is required for permission changes." };
  }
  if (
    roleSafetySettings.preventAdminSelfDemotion &&
    actorId === userId &&
    beforeNorm === "administrator" &&
    afterNorm !== "administrator"
  ) {
    return { ok: false, message: "You cannot demote your own administrator role." };
  }

  if (
    roleSafetySettings.preventLastAdminRemoval &&
    beforeNorm === "administrator" &&
    afterNorm !== "administrator"
  ) {
    const soleRemainingAdmin = await isLastActiveAdministrator(userId);
    if (soleRemainingAdmin) {
      await createSystemAuditLog({
        actorUserId: actorId,
        module: "User Accounts",
        action: "changed_user_role",
        targetType: "user",
        targetId: userId,
        targetLabel: `User: ${target.email}`,
        success: false,
        failureReason: "You cannot remove the last active administrator.",
        metadata: {
          changes: [
            {
              field: "role",
              label: "Role",
              type: "changed",
              before: beforeRoleRaw,
              after: role,
              format: "text",
            },
          ],
        },
        ipAddress: ip,
        deviceName: deviceLabel,
        userAgent,
      });
      return { ok: false, message: "You cannot remove the last active administrator." };
    }
  }

  try {
    const localName = target.email.split("@")[0]?.trim() || "User";
    await prisma.userProfile.upsert({
      where: { user_id: userId },
      update: { role, updated_at: new Date() },
      create: {
        user_id: userId,
        full_name: localName,
        initials: localName.slice(0, 2).toUpperCase(),
        role,
      },
    });

    revalidateUsers();
    await createSystemAuditLog({
      actorUserId: actorId,
      module: "User Accounts",
      action: "changed_user_role",
      targetType: "user",
      targetId: userId,
      targetLabel: `User: ${target.email}`,
      success: true,
      metadata: {
        changes: [
          {
            field: "role",
            label: "Role",
            type: "changed",
            before: beforeRoleRaw,
            after: role,
            format: "text",
          },
        ],
        reason: reason?.trim() || null,
      },
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    await sendHrNotification({
      notificationType: "user_role_changed",
      settingKey: "sendSecurityAdminAlerts",
      recipientMode: "hr_only",
      subject: "User Role Changed",
      text: buildSimpleHrTemplate({
        lines: [`User: ${target.email}`, `Role changed to: ${role}`],
      }),
      metadata: { userId, role, beforeRole: beforeRoleRaw },
    });
    return { ok: true, message: "Role updated successfully." };
  } catch (e) {
    console.error("[updateUserRoleAction]", e);
    await createSystemAuditLog({
      actorUserId: actorId,
      module: "User Accounts",
      action: "changed_user_role",
      targetType: "user",
      targetId: userId,
      targetLabel: `User: ${target.email}`,
      success: false,
      failureReason: "Failed to update role. Please try again.",
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { ok: false, message: "Failed to update role. Please try again." };
  }
}

export async function deactivateUserAction(userId: string): Promise<UserMutationResult> {
  const auth = await requirePermission("users.edit");
  const actorId = auth?.userId ?? null;
  if (!actorId) return { ok: false };
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  const targetLabel = await resolveUserAuditTargetLabel(userId);
  if (userId === actorId) {
    await createSystemAuditLog({
      actorUserId: actorId,
      module: "User Accounts",
      action: "deactivated_user",
      targetType: "user",
      targetId: userId,
      targetLabel,
      success: false,
      failureReason: "Cannot deactivate your own account.",
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { ok: false };
  }
  const roleSafetySettings = await getRoleSafetySettings();
  if (roleSafetySettings.preventLastAdminRemoval && (await isLastActiveAdministrator(userId))) {
    return { ok: false, message: "You cannot remove the last active administrator." };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { is_active: false, updated_at: new Date() },
    });
    revalidateUsers();
    await createSystemAuditLog({
      actorUserId: actorId,
      module: "User Accounts",
      action: "deactivated_user",
      targetType: "user",
      targetId: userId,
      targetLabel,
      success: true,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    await sendHrNotification({
      notificationType: "user_deactivated",
      settingKey: "sendSecurityAdminAlerts",
      recipientMode: "hr_only",
      subject: "User Deactivated",
      text: buildSimpleHrTemplate({ lines: [`A user account was deactivated.`, `User ID: ${userId}`] }),
      metadata: { userId },
    });
    return { ok: true };
  } catch {
    await createSystemAuditLog({
      actorUserId: actorId,
      module: "User Accounts",
      action: "deactivated_user",
      targetType: "user",
      targetId: userId,
      targetLabel,
      success: false,
      failureReason: "Failed to deactivate user. Please try again.",
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { ok: false };
  }
}

export async function deleteUserPermanentlyAction(userId: string): Promise<UserMutationResult> {
  const auth = await requirePermission("users.delete");
  const actorId = auth?.userId ?? null;
  if (!actorId) return { ok: false };
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  const targetLabel = await resolveUserAuditTargetLabel(userId);
  if (userId === actorId) {
    await createSystemAuditLog({
      actorUserId: actorId,
      module: "User Accounts",
      action: "deleted_user",
      targetType: "user",
      targetId: userId,
      targetLabel,
      success: false,
      failureReason: "Cannot delete your own account.",
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { ok: false };
  }
  const roleSafetySettings = await getRoleSafetySettings();
  if (roleSafetySettings.preventLastAdminRemoval && (await isLastActiveAdministrator(userId))) {
    return { ok: false, message: "You cannot remove the last active administrator." };
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
    revalidateUsers();
    await createSystemAuditLog({
      actorUserId: actorId,
      module: "User Accounts",
      action: "deleted_user",
      targetType: "user",
      targetId: userId,
      targetLabel,
      success: true,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    await sendHrNotification({
      notificationType: "user_deleted",
      settingKey: "sendSecurityAdminAlerts",
      recipientMode: "hr_only",
      subject: "User Deleted",
      text: buildSimpleHrTemplate({ lines: [`A user account was deleted.`, `User ID: ${userId}`] }),
      metadata: { userId },
    });
    return { ok: true };
  } catch {
    await createSystemAuditLog({
      actorUserId: actorId,
      module: "User Accounts",
      action: "deleted_user",
      targetType: "user",
      targetId: userId,
      targetLabel,
      success: false,
      failureReason: "Failed to delete user. Please try again.",
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { ok: false };
  }
}

export async function changeOwnPasswordAction(input: unknown): Promise<PasswordChangeResult> {
  const actorId = await requireSessionUserId();
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: {
      email: true,
      must_change_password: true,
      profile: { select: { full_name: true } },
    },
  });
  const requiredPasswordChange = actor?.must_change_password === true;
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  const parsed = changeOwnPasswordSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    await createSystemAuditLog({
      actorUserId: actorId,
      actorEmail: actor?.email ?? null,
      actorName: actor?.profile?.full_name ?? null,
      module: "Profile",
      action: "changed_password",
      targetType: "user",
      targetId: actorId,
      targetLabel: actor?.email ? `User: ${actor.email}` : "User: Unknown",
      success: false,
      failureReason: firstIssue || "Failed to change password. Please try again.",
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return {
      success: false,
      message: firstIssue || "Failed to change password. Please try again.",
    };
  }

  const { newPassword } = parsed.data;
  const passwordPolicy = await getPasswordPolicySettings();
  const passwordIssue = validatePasswordAgainstPolicy(newPassword, passwordPolicy);
  if (passwordIssue) {
    return {
      success: false,
      message: passwordIssue,
    };
  }

  try {
    const updated = await prisma.$executeRaw(
      Prisma.sql`
        UPDATE public.users
        SET
          password_hash = crypt(${newPassword}::text, gen_salt('bf')),
          must_change_password = false,
          updated_at = NOW()
        WHERE id = ${actorId}::uuid
      `,
    );

    if (updated < 1) {
      await createSystemAuditLog({
        actorUserId: actorId,
        actorEmail: actor?.email ?? null,
        actorName: actor?.profile?.full_name ?? null,
        module: "Profile",
        action: "changed_password",
        targetType: "user",
        targetId: actorId,
        targetLabel: actor?.email ? `User: ${actor.email}` : "User: Unknown",
        success: false,
        failureReason: "Failed to change password. Please try again.",
        ipAddress: ip,
        deviceName: deviceLabel,
        userAgent,
      });
      return { success: false, message: "Failed to change password. Please try again." };
    }

    revalidatePath("/profile");
    await createLoginAuditLog({
      userId: actorId,
      emailAttempted: actor?.email || "unknown",
      action: "password_change",
      success: true,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    await createSystemAuditLog({
      actorUserId: actorId,
      actorEmail: actor?.email ?? null,
      actorName: actor?.profile?.full_name ?? null,
      module: "Profile",
      action: "changed_password",
      targetType: "user",
      targetId: actorId,
      targetLabel: actor?.email ? `User: ${actor.email}` : "User: Unknown",
      success: true,
      metadata: requiredPasswordChange ? { requiredPasswordChangeCompleted: true } : undefined,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    if (requiredPasswordChange) {
      await createSystemAuditLog({
        actorUserId: actorId,
        actorEmail: actor?.email ?? null,
        actorName: actor?.profile?.full_name ?? null,
        module: "Authentication",
        action: "default_admin_password_changed",
        targetType: "user",
        targetId: actorId,
        targetLabel: actor?.email ? `User: ${actor.email}` : "User: Unknown",
        success: true,
        ipAddress: ip,
        deviceName: deviceLabel,
        userAgent,
      });
    }

    try {
      const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
      if (session.user?.userId === actorId) {
        session.user.mustChangePassword = false;
        await session.save();
      }
    } catch {
      // Password change succeeded; session refresh failure should not block the result.
    }

    return { success: true, message: "Password changed successfully." };
  } catch {
    await createSystemAuditLog({
      actorUserId: actorId,
      actorEmail: actor?.email ?? null,
      actorName: actor?.profile?.full_name ?? null,
      module: "Profile",
      action: "changed_password",
      targetType: "user",
      targetId: actorId,
      targetLabel: actor?.email ? `User: ${actor.email}` : "User: Unknown",
      success: false,
      failureReason: "Failed to change password. Please try again.",
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { success: false, message: "Failed to change password. Please try again." };
  }
}

export async function attachEmployeeToUserAction(input: {
  userId: string;
  employeeId: string;
}): Promise<UserEmployeeLinkResult> {
  const auth = await requirePermission("users.attachEmployee");
  const actorId = auth?.userId ?? null;
  if (!actorId) return { ok: false, message: "You do not have permission to perform this action." };
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  const userId = input.userId?.trim();
  const employeeId = input.employeeId?.trim();
  if (!userId || !employeeId) {
    return { ok: false, message: "Failed to attach employee record. Please try again." };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          user_id: string;
          user_email: string;
          before_employee_id: string | null;
          before_employee_name: string | null;
          target_employee_name: string | null;
        }>
      >(Prisma.sql`
        SELECT
          p.user_id::text AS user_id,
          u.email AS user_email,
          p.employee_id::text AS before_employee_id,
          trim(be.first_name || ' ' || be.last_name) AS before_employee_name,
          trim(te.first_name || ' ' || te.last_name) AS target_employee_name
        FROM public.user_profiles p
        JOIN public.users u
          ON u.id = p.user_id
        LEFT JOIN public.employees be
          ON be.id = p.employee_id
        LEFT JOIN public.employees te
          ON te.id = ${employeeId}::uuid
        WHERE p.user_id = ${userId}::uuid
        LIMIT 1
      `);
      const row = rows[0];
      if (!row) throw new Error("User profile not found.");
      if (!row.target_employee_name) throw new Error("Employee record not found.");

      const duplicate = await tx.$queryRaw<Array<{ user_id: string }>>(Prisma.sql`
        SELECT user_id::text AS user_id
        FROM public.user_profiles
        WHERE employee_id = ${employeeId}::uuid
          AND user_id <> ${userId}::uuid
        LIMIT 1
      `);
      if (duplicate.length > 0) {
        throw new Error("This employee record is already attached to another user account.");
      }

      await tx.$executeRaw(Prisma.sql`
        UPDATE public.user_profiles
        SET employee_id = ${employeeId}::uuid, updated_at = NOW()
        WHERE user_id = ${userId}::uuid
      `);

      return row;
    });

    const changed = Boolean(result.before_employee_id && result.before_employee_id !== employeeId);
    const action = changed
      ? "changed_attached_employee"
      : "attached_employee_to_user";
    const message = changed
      ? "Attached employee record updated successfully."
      : "Employee record attached successfully.";

    await createSystemAuditLog({
      actorUserId: actorId,
      module: "User Accounts",
      action,
      targetType: "user",
      targetId: userId,
      targetLabel: `User: ${result.user_email}`,
      success: true,
      metadata: {
        changes: [
          {
            field: "employee_id",
            label: "Linked Employee",
            type: "changed",
            before: result.before_employee_id,
            after: employeeId,
            format: "text",
          },
          {
            field: "employee_name",
            label: "Employee Name",
            type: "changed",
            before: result.before_employee_name,
            after: result.target_employee_name,
            format: "text",
          },
        ],
      },
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });

    revalidateUsers();
    revalidatePath("/profile");
    return { ok: true, message };
  } catch (error) {
    const failureReason =
      error instanceof Error && error.message
        ? error.message
        : "Failed to attach employee record. Please try again.";
    await createSystemAuditLog({
      actorUserId: actorId,
      module: "User Accounts",
      action: "attached_employee_to_user",
      targetType: "user",
      targetId: userId || null,
      targetLabel: "User: attempted attachment",
      success: false,
      failureReason,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { ok: false, message: failureReason };
  }
}

export async function removeAttachedEmployeeFromUserAction(userIdInput: string): Promise<UserEmployeeLinkResult> {
  const auth = await requirePermission("users.attachEmployee");
  const actorId = auth?.userId ?? null;
  if (!actorId) return { ok: false, message: "You do not have permission to perform this action." };
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  const userId = userIdInput?.trim();
  if (!userId) return { ok: false, message: "Failed to remove employee record link. Please try again." };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          user_email: string;
          before_employee_id: string | null;
          before_employee_name: string | null;
        }>
      >(Prisma.sql`
        SELECT
          u.email AS user_email,
          p.employee_id::text AS before_employee_id,
          trim(e.first_name || ' ' || e.last_name) AS before_employee_name
        FROM public.user_profiles p
        JOIN public.users u
          ON u.id = p.user_id
        LEFT JOIN public.employees e
          ON e.id = p.employee_id
        WHERE p.user_id = ${userId}::uuid
        LIMIT 1
      `);
      const row = rows[0];
      if (!row) throw new Error("User profile not found.");

      await tx.$executeRaw(Prisma.sql`
        UPDATE public.user_profiles
        SET employee_id = NULL, updated_at = NOW()
        WHERE user_id = ${userId}::uuid
      `);
      return row;
    });

    await createSystemAuditLog({
      actorUserId: actorId,
      module: "User Accounts",
      action: "removed_employee_from_user",
      targetType: "user",
      targetId: userId,
      targetLabel: `User: ${result.user_email}`,
      success: true,
      metadata: {
        changes: [
          {
            field: "employee_id",
            label: "Linked Employee",
            type: "removed",
            before: result.before_employee_id,
            after: null,
            format: "text",
          },
          {
            field: "employee_name",
            label: "Employee Name",
            type: "removed",
            before: result.before_employee_name,
            after: null,
            format: "text",
          },
        ],
      },
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });

    revalidateUsers();
    revalidatePath("/profile");
    return { ok: true, message: "Employee record link removed successfully." };
  } catch (error) {
    const failureReason =
      error instanceof Error && error.message
        ? error.message
        : "Failed to remove employee record link. Please try again.";
    await createSystemAuditLog({
      actorUserId: actorId,
      module: "User Accounts",
      action: "removed_employee_from_user",
      targetType: "user",
      targetId: userId || null,
      targetLabel: "User: attempted unlink",
      success: false,
      failureReason,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { ok: false, message: failureReason };
  }
}
