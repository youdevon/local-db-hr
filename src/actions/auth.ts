"use server";

import { Prisma } from "@prisma/client";
import { getIronSession } from "iron-session";
import type { IronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isNextRedirectError } from "@/lib/next-redirect";
import { createLoginAuditLog, createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";
import { clearSessionCookie } from "@/lib/get-session";
import { normalizeUserRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { getLoginNoticeSettings, getLoginProtectionSettings } from "@/lib/security-settings";
import { DASHBOARD_HREF, sessionOptions, type SessionData } from "@/lib/session";

const GENERIC_LOGIN_ERROR = "Invalid email or password." as const;
const AUDIT_FAILURE_REASON = "Invalid email or password." as const;

const loginSchema = z.object({
  email: z.string().trim().min(1).email(),
  // Do not trim: passwords may contain intentional spaces (e.g. "Password 1").
  password: z.string().min(1),
});

export type LoginActionState = {
  error?: string;
};

type AuthenticatedUserRow = {
  id: string;
  email: string;
  is_active: boolean | null;
  is_locked: boolean | null;
};

type UserLookupRow = {
  id: string;
  email: string;
  is_active: boolean | null;
  is_locked: boolean | null;
  failed_login_attempts: number | null;
};

function loginDebug(message: string, meta?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") {
    console.info(`[login] ${message}`, meta ?? {});
  }
}

async function recordFailedLogin(params: {
  emailAttempted: string;
  userId: string | null;
  ip: string | null;
  userAgent: string | null;
  deviceLabel: string | null;
}) {
  const { emailAttempted, userId, ip, userAgent, deviceLabel } = params;

  if (userId) {
    await prisma.user.update({
      where: { id: userId },
      data: { failed_login_attempts: { increment: 1 } },
    });
  }

  await createLoginAuditLog({
    userId,
    emailAttempted,
    action: "failed_login",
    success: false,
    ipAddress: ip,
    deviceName: deviceLabel,
    userAgent,
    failureReason: AUDIT_FAILURE_REASON,
  });
}

async function getLastFailedLoginAt(userId: string): Promise<Date | null> {
  const rows = await prisma.$queryRaw<Array<{ created_at: Date | null }>>(
    Prisma.sql`
      SELECT created_at
      FROM public.login_audit_logs
      WHERE user_id = ${userId}::uuid
        AND action = 'failed_login'
      ORDER BY created_at DESC
      LIMIT 1
    `,
  );
  return rows[0]?.created_at ?? null;
}

export async function loginAction(
  _prev: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: GENERIC_LOGIN_ERROR };
  }

  const email = parsed.data.email;
  const password = parsed.data.password;
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  const normalizedEmail = email.toLowerCase();
  const [loginProtectionSettings, loginNoticeSettings] = await Promise.all([
    getLoginProtectionSettings(),
    getLoginNoticeSettings(),
  ]);

  if (loginNoticeSettings.enabled && loginNoticeSettings.requireAcknowledgement) {
    const acknowledged = formData.get("acknowledgeLoginNotice");
    if (acknowledged !== "on") {
      return { error: "You must acknowledge the security notice before signing in." };
    }
  }

  loginDebug("attempt", { normalizedEmail });

  try {
    // Clear potentially stale/expired cookie before creating a fresh authenticated session.
    await clearSessionCookie();

    const usersByEmail = await prisma.$queryRaw<UserLookupRow[]>(
      Prisma.sql`
        SELECT u.id::text AS id,
               u.email::text AS email,
               u.is_active AS is_active,
               u.is_locked AS is_locked,
               u.failed_login_attempts AS failed_login_attempts
        FROM public.users u
        WHERE lower(u.email) = lower(${email}::text)
        LIMIT 1
      `,
    );
    const userByEmail = usersByEmail[0];

    if (
      userByEmail?.is_locked &&
      loginProtectionSettings.enableLockout
    ) {
      const lastFailedAt = await getLastFailedLoginAt(userByEmail.id);
      if (lastFailedAt) {
        const elapsedMs = Date.now() - lastFailedAt.getTime();
        if (elapsedMs >= loginProtectionSettings.lockoutMinutes * 60 * 1000) {
          await prisma.user.update({
            where: { id: userByEmail.id },
            data: { is_locked: false, failed_login_attempts: 0 },
          });
        } else {
          await recordFailedLogin({
            emailAttempted: normalizedEmail,
            userId: userByEmail.id,
            ip,
            userAgent,
            deviceLabel,
          });
          return { error: GENERIC_LOGIN_ERROR };
        }
      }
    }

    const result = await prisma.$queryRaw<AuthenticatedUserRow[]>(
      Prisma.sql`
        SELECT u.id::text AS id,
               u.email::text AS email,
               u.is_active AS is_active,
               u.is_locked AS is_locked
        FROM public.users u
        WHERE lower(u.email) = lower(${email}::text)
          AND u.password_hash = crypt(${password}::text, u.password_hash)
        LIMIT 1
      `,
    );

    const row = result[0];

    if (!row) {
      const existing = userByEmail;
      loginDebug("crypt mismatch or unknown user", {
        normalizedEmail,
        userRowFound: Boolean(existing),
      });

      await recordFailedLogin({
        emailAttempted: normalizedEmail,
        userId: existing?.id ?? null,
        ip,
        userAgent,
        deviceLabel,
      });

      if (existing?.id && loginProtectionSettings.enableLockout) {
        const nextAttempts = (existing.failed_login_attempts ?? 0) + 1;
        const shouldLock = nextAttempts >= loginProtectionSettings.maxFailedAttempts;
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            failed_login_attempts: nextAttempts,
            is_locked: shouldLock,
          },
        });
      }
      return { error: GENERIC_LOGIN_ERROR };
    }

    const inactive = row.is_active === false;
    const locked = row.is_locked === true;
    if (inactive || locked) {
      loginDebug("user inactive or locked", {
        normalizedEmail,
        userRowFound: true,
        inactive,
        locked,
      });
      await recordFailedLogin({
        emailAttempted: normalizedEmail,
        userId: row.id,
        ip,
        userAgent,
        deviceLabel,
      });
      return { error: GENERIC_LOGIN_ERROR };
    }

    loginDebug("authenticated", {
      normalizedEmail,
      userRowFound: true,
    });

    const user = await prisma.user.findUnique({
      where: { id: row.id },
      select: {
        id: true,
        email: true,
        must_change_password: true,
        profile: {
          select: {
            full_name: true,
            role: true,
            department: true,
          },
        },
      },
    });

    if (!user) {
      await recordFailedLogin({
        emailAttempted: normalizedEmail,
        userId: row.id,
        ip,
        userAgent,
        deviceLabel,
      });
      return { error: GENERIC_LOGIN_ERROR };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        last_login_at: new Date(),
        last_login_ip: ip,
        last_login_device: deviceLabel ?? userAgent,
        ...(loginProtectionSettings.resetOnSuccessfulLogin
          ? { failed_login_attempts: 0, is_locked: false }
          : {}),
      },
    });

    await createLoginAuditLog({
      userId: user.id,
      emailAttempted: normalizedEmail,
      action: "login",
      success: true,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
      failureReason: null,
    });

    const mustChangePassword = user.must_change_password === true;
    if (mustChangePassword) {
      await createSystemAuditLog({
        actorUserId: user.id,
        actorEmail: user.email,
        actorName: user.profile?.full_name ?? null,
        module: "Authentication",
        action: "default_admin_first_login",
        targetType: "user",
        targetId: user.id,
        targetLabel: `User: ${user.email}`,
        success: true,
        metadata: { mustChangePassword: true },
        ipAddress: ip,
        deviceName: deviceLabel,
        userAgent,
      });
    }

    let session: IronSession<SessionData>;
    try {
      session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    } catch {
      await clearSessionCookie();
      session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    }
    const userRole = normalizeUserRole(user.profile?.role);
    session.user = {
      userId: user.id,
      email: user.email,
      name: user.profile?.full_name ?? user.email,
      role: userRole,
      department: user.profile?.department ?? null,
      mustChangePassword,
    };
    const now = Date.now();
    session.createdAt = now;
    session.lastActivityAt = now;
    await session.save();
    loginDebug("session saved", {
      userId: user.id,
      role: userRole,
      cookieName: sessionOptions.cookieName,
      mustChangePassword,
    });

    redirect(mustChangePassword ? "/profile?changePassword=required" : DASHBOARD_HREF);
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    loginDebug("error", { normalizedEmail, message: err instanceof Error ? err.message : String(err) });
    return { error: GENERIC_LOGIN_ERROR };
  }
}

export async function logoutAction() {
  await logoutWithoutRedirectAction("manual");
  redirect("/login");
}

export async function logoutWithoutRedirectAction(
  reason: "manual" | "inactivity" | "inactivity_timeout" | "session_expired" = "manual",
): Promise<{ success: boolean }> {
  let session: IronSession<SessionData>;
  try {
    session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  } catch {
    await clearSessionCookie();
    try {
      session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    } catch {
      return { success: true };
    }
  }
  const user = session.user;
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  const actorName = user?.name?.trim() ? user.name.trim() : "Unknown";

  try {
    if (user) {
      if (reason === "inactivity" || reason === "inactivity_timeout") {
        await createLoginAuditLog({
          userId: user.userId,
          emailAttempted: user.email,
          action: "logout",
          success: true,
          ipAddress: ip,
          deviceName: deviceLabel,
          userAgent,
          failureReason: "inactivity_timeout",
        });
        await createSystemAuditLog({
          actorUserId: user.userId,
          actorEmail: user.email,
          actorName,
          module: "Authentication",
          action: "session_timeout_logout",
          targetType: "user",
          targetId: user.userId,
          targetLabel: `User: ${user.email}`,
          success: true,
          metadata: { reason: "inactivity_timeout" },
          ipAddress: ip,
          deviceName: deviceLabel,
          userAgent,
        });
      } else if (reason === "session_expired") {
        await createLoginAuditLog({
          userId: user.userId,
          emailAttempted: user.email,
          action: "logout",
          success: true,
          ipAddress: ip,
          deviceName: deviceLabel,
          userAgent,
          failureReason: "session_expired",
        });
        await createSystemAuditLog({
          actorUserId: user.userId,
          actorEmail: user.email,
          actorName,
          module: "Authentication",
          action: "session_expired_logout",
          targetType: "user",
          targetId: user.userId,
          targetLabel: `User: ${user.email}`,
          success: true,
          metadata: { reason: "session_expired" },
          ipAddress: ip,
          deviceName: deviceLabel,
          userAgent,
        });
      } else {
        await createLoginAuditLog({
          userId: user.userId,
          emailAttempted: user.email,
          action: "logout",
          success: true,
          ipAddress: ip,
          deviceName: deviceLabel,
          userAgent,
        });
        await createSystemAuditLog({
          actorUserId: user.userId,
          actorEmail: user.email,
          actorName,
          module: "Authentication",
          action: "logged_out",
          targetType: "user",
          targetId: user.userId,
          targetLabel: `User: ${user.email}`,
          success: true,
          ipAddress: ip,
          deviceName: deviceLabel,
          userAgent,
        });
      }
    }
  } catch {
    // Do not block logout on audit failures.
  } finally {
    session.destroy();
    await session.save();
    await clearSessionCookie().catch(() => undefined);
  }

  return { success: true };
}
