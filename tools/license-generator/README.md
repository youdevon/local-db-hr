# D3HR licence key generator (provider tool)

**This package is for the software provider only.** It is not part of the client-facing HR web app and must not be deployed alongside customer databases.

It uses **Ed25519** asymmetric keys with [`jose`](https://github.com/panva/jose):

- **Private key** — signs licence keys. Keep offline and **never** ship it with the HR application.
- **Public key** — verifies signatures. Embed the public key only (e.g. `LICENSE_PUBLIC_KEY_PEM` in the HR server environment).

Issued keys use the format:

```text
D3HR.<JWS compact JWT>
```

## Setup

```bash
cd tools/license-generator
npm install
cp .env.example .env
```

## Generate a keypair (once per product line / signing identity)

```bash
npm run generate-keypair
```

By default this writes:

- `keys/license-private.pem` — **secret** (chmod 600)
- `keys/license-public.pem` — safe to copy into the HR app’s environment

Override output directory with `LICENSE_KEYS_DIR` in `.env`.

Add to `.gitignore` (already done in the monorepo root):

- `tools/license-generator/.env`
- `tools/license-generator/keys/*.pem`

**Never commit real private keys.**

## Generate a licence

Requires `LICENSE_PRIVATE_KEY_PATH` (see `.env.example`) pointing at the PKCS #8 private PEM.

Example:

```bash
npm run generate -- --org "ABC Company Ltd" --type trial --expires "2026-08-05" --grace 14 --max-users 500 --max-employees 500
```

Optional flags:

| Flag | Meaning |
|------|---------|
| `--issued-by` | Display name of issuer (default: `D3 Services`) |
| `--notes` | Free-text notes stored in the payload |
| `--product` | Must remain `Local DB HR` (default) to match the verifier |
| `--issued-at` | Issue date `YYYY-MM-DD` (default: today, UTC midnight anchor for generator) |
| `--max-users` / `--max-employees` | Omit for unlimited |

**`--expires`** is required for `trial` and `active`. For `permanent` it may be omitted. For `suspended`, set `--expires` if you need a bounded window.

Output includes a **generated licence key** starting with `D3HR.`.

## Verify a licence (local QA)

Requires `LICENSE_PUBLIC_KEY_PATH` (default: `./keys/license-public.pem`).

```bash
npm run verify -- --key "D3HR.eyJ..."
```

This checks the Ed25519 signature, decodes the payload, prints fields, and summarises **permanent / active / grace / expired** using the same calendar rules as the HR app (approximate in CLI).

## HR application integration

Copy the contents of `license-public.pem` into the HR server environment variable **`LICENSE_PUBLIC_KEY_PEM`** (multi-line PEM or with `\n` escapes). Administrators can paste a `D3HR.` key on **Settings → Licence & Activation**; the app verifies with the public key only and stores settings in `app_settings.license_settings`.

The signing **private** key must **not** appear anywhere in the HR app codebase or runtime images.
