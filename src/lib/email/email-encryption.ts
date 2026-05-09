import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY_ERROR = "Email encryption key is not configured.";

function getRawEncryptionKeyFromEnv(): string | null {
  const raw = process.env.EMAIL_SETTINGS_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  return raw;
}

function deriveEncryptionKey(raw: string): Buffer {
  return createHash("sha256").update(raw, "utf8").digest();
}

export function isEmailEncryptionConfigured(): boolean {
  return Boolean(getRawEncryptionKeyFromEnv());
}

function getEncryptionKeyOrThrow(): Buffer {
  const raw = getRawEncryptionKeyFromEnv();
  if (!raw) {
    throw new Error(ENCRYPTION_KEY_ERROR);
  }
  return deriveEncryptionKey(raw);
}

export function getEmailEncryptionErrorMessage(): string | null {
  return isEmailEncryptionConfigured() ? null : ENCRYPTION_KEY_ERROR;
}

export function encryptEmailSecret(plainText: string): string {
  const key = getEncryptionKeyOrThrow();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptEmailSecret(encryptedValue: string): string {
  const key = getEncryptionKeyOrThrow();
  const [ivB64, tagB64, dataB64] = encryptedValue.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Stored SMTP password could not be decrypted.");
  }
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return decrypted.toString("utf8");
}
