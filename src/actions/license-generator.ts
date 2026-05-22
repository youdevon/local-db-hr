"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";
import { getSession } from "@/lib/get-session";
import {
  getLicensePublicKeyPemFromEnv,
  verifyD3hrLicenseKey,
  VerifyLicenseKeyError,
  type SignedLicenseClaims,
} from "@/lib/license-key-verification";
import {
  formatLicenseGeneratorAuditMetadata,
  generateProviderLicenseKey,
  isLicenseGeneratorEnabled,
  isLicensePrivateKeyConfigured,
  LicenseGeneratorError,
  previewLicenseStatus,
  type GenerateProviderLicenseInput,
} from "@/lib/licensing/provider-license-generator";
import { PROVIDER_LICENSE_TYPES } from "@/lib/licensing/license-payload";
import { normalizeUserRole } from "@/lib/roles";

const GENERATOR_DISABLED_MESSAGE = "Licence generator is not available in this installation.";
const GENERATOR_PERMISSION_MESSAGE = "You do not have permission to use the licence generator.";
const PRIVATE_KEY_MISSING_MESSAGE =
  "Private signing key is not configured. Set LICENSE_PRIVATE_KEY_PEM or LICENSE_PRIVATE_KEY_PATH on the server.";

const generateSchema = z.object({
  organizationName: z.string().trim().min(1, "Organization name is required.").max(180),
  licenseType: z.enum(["trial", "active", "permanent", "suspended"]),
  expiresAt: z.string().trim().optional(),
  gracePeriodDays: z.coerce.number().int().min(0).max(3650),
  maxUsers: z.union([z.literal(""), z.coerce.number().int().min(0).max(100_000)]).optional(),
  maxEmployees: z.union([z.literal(""), z.coerce.number().int().min(0).max(10_000_000)]).optional(),
  issuedBy: z.string().trim().max(180).optional(),
  notes: z.string().max(4000).optional(),
});

type GeneratorActionResult =
  | {
      success: true;
      licenseKey: string;
      claims: SignedLicenseClaims;
      statusPreview: ReturnType<typeof previewLicenseStatus>;
    }
  | { success: false; message: string };

type VerifyActionResult =
  | {
      success: true;
      claims: SignedLicenseClaims;
      statusPreview: ReturnType<typeof previewLicenseStatus>;
    }
  | { success: false; message: string };

async function requireAdminForGenerator() {
  if (!isLicenseGeneratorEnabled()) return null;
  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  if (!session.user?.userId || role !== "administrator") return null;
  return session.user;
}

export async function getLicenseGeneratorPageState(): Promise<{
  enabled: boolean;
  privateKeyConfigured: boolean;
  publicKeyConfigured: boolean;
}> {
  const enabled = isLicenseGeneratorEnabled();
  if (!enabled) {
    return { enabled: false, privateKeyConfigured: false, publicKeyConfigured: false };
  }

  const [privateKeyConfigured, publicKeyConfigured] = await Promise.all([
    isLicensePrivateKeyConfigured(),
    Promise.resolve(Boolean(getLicensePublicKeyPemFromEnv())),
  ]);

  return { enabled, privateKeyConfigured, publicKeyConfigured };
}

export async function generateProviderLicenseKeyAction(input: unknown): Promise<GeneratorActionResult> {
  const actor = await requireAdminForGenerator();
  if (!isLicenseGeneratorEnabled()) {
    return { success: false, message: GENERATOR_DISABLED_MESSAGE };
  }
  if (!actor) {
    return { success: false, message: GENERATOR_PERMISSION_MESSAGE };
  }

  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid licence generator input." };
  }

  const data = parsed.data;
  const payload: GenerateProviderLicenseInput = {
    organizationName: data.organizationName,
    licenseType: data.licenseType,
    expiresAt: data.expiresAt?.trim() || null,
    gracePeriodDays: data.gracePeriodDays,
    maxUsers: data.maxUsers === "" || data.maxUsers == null ? null : Number(data.maxUsers),
    maxEmployees: data.maxEmployees === "" || data.maxEmployees == null ? null : Number(data.maxEmployees),
    issuedBy: data.issuedBy?.trim() || "D3 Services",
    notes: data.notes ?? "",
  };

  let licenseKey: string;
  let claims: Awaited<ReturnType<typeof generateProviderLicenseKey>>["claims"];
  try {
    const result = await generateProviderLicenseKey(payload);
    licenseKey = result.licenseKey;
    claims = result.claims;
  } catch (e) {
    if (e instanceof LicenseGeneratorError) {
      return { success: false, message: e.message };
    }
    return { success: false, message: "Failed to generate licence key." };
  }

  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  await createSystemAuditLog({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    actorName: actor.name,
    module: "License",
    action: "generated_provider_license_key",
    targetType: "settings",
    targetLabel: "Settings: Licence Generator",
    success: true,
    metadata: formatLicenseGeneratorAuditMetadata(claims, licenseKey),
    ipAddress: ip,
    deviceName: deviceLabel,
    userAgent,
  });

  revalidatePath("/settings/licence-generator");

  return {
    success: true,
    licenseKey,
    claims,
    statusPreview: previewLicenseStatus(claims),
  };
}

export async function verifyProviderLicenseKeyAction(licenseKey: string): Promise<VerifyActionResult> {
  const actor = await requireAdminForGenerator();
  if (!isLicenseGeneratorEnabled()) {
    return { success: false, message: GENERATOR_DISABLED_MESSAGE };
  }
  if (!actor) {
    return { success: false, message: GENERATOR_PERMISSION_MESSAGE };
  }

  const pem = getLicensePublicKeyPemFromEnv();
  if (!pem) {
    return {
      success: false,
      message:
        "Licence verification is not configured. Set LICENSE_PUBLIC_KEY_PEM on the server with the Ed25519 public key PEM.",
    };
  }

  if (typeof licenseKey !== "string" || !licenseKey.trim()) {
    return { success: false, message: 'Paste a licence key that starts with "D3HR."' };
  }

  try {
    const claims = await verifyD3hrLicenseKey(licenseKey, pem);
    return {
      success: true,
      claims,
      statusPreview: previewLicenseStatus(claims),
    };
  } catch (e) {
    if (e instanceof VerifyLicenseKeyError) {
      return { success: false, message: e.message };
    }
    return { success: false, message: "Licence verification failed." };
  }
}

export async function assertLicenseGeneratorAvailable(): Promise<{
  privateKeyConfigured: boolean;
  publicKeyConfigured: boolean;
}> {
  if (!isLicenseGeneratorEnabled()) {
    throw new Error(GENERATOR_DISABLED_MESSAGE);
  }

  const privateKeyConfigured = await isLicensePrivateKeyConfigured();
  const publicKeyConfigured = Boolean(getLicensePublicKeyPemFromEnv());

  return { privateKeyConfigured, publicKeyConfigured };
}
