#!/usr/bin/env node
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import "dotenv/config";

async function main() {
  const keysDir = process.env.LICENSE_KEYS_DIR?.trim() || path.join(process.cwd(), "keys");
  await fs.mkdir(keysDir, { recursive: true });

  const privatePath = path.join(keysDir, "license-private.pem");
  const publicPath = path.join(keysDir, "license-public.pem");

  const { publicKey, privateKey } = await generateKeyPair("Ed25519", { extractable: true });
  const privPem = await exportPKCS8(privateKey);
  const pubPem = await exportSPKI(publicKey);

  await fs.writeFile(privatePath, privPem, { mode: 0o600 });
  await fs.writeFile(publicPath, pubPem, { mode: 0o644 });

  console.info(`Ed25519 keypair written to:`);
  console.info(`  Private (keep secret, never commit): ${privatePath}`);
  console.info(`  Public (distribute to HR app as LICENSE_PUBLIC_KEY_PEM): ${publicPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
