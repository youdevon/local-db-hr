#!/usr/bin/env bash
#
# Idempotently ensure LICENSE_PUBLIC_KEY_PEM is set in .env from the bundled
# product public key (config/license-public-key.pem). Never writes private keys.
#
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${ROOT}/.env"
PUBLIC_KEY_FILE="${ROOT}/config/license-public-key.pem"

if [[ ! -f "$PUBLIC_KEY_FILE" ]]; then
  echo "WARNING: Missing ${PUBLIC_KEY_FILE}. Set LICENSE_PUBLIC_KEY_PEM manually in .env." >&2
  exit 0
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "${ROOT}/.env.example" "$ENV_FILE"
  echo "Created ${ENV_FILE} from .env.example"
fi

if grep -q '^LICENSE_PUBLIC_KEY_PEM=.\+' "$ENV_FILE" 2>/dev/null; then
  exit 0
fi

PUBLIC_KEY_ESCAPED="$(awk 'NF {sub(/\r$/,""); printf "%s\\n", $0}' "$PUBLIC_KEY_FILE" | sed 's/\\n$//')"

if grep -q '^LICENSE_PUBLIC_KEY_PEM=' "$ENV_FILE" 2>/dev/null; then
  tmp="$(mktemp)"
  awk -v val="$PUBLIC_KEY_ESCAPED" '
    /^LICENSE_PUBLIC_KEY_PEM=/ { print "LICENSE_PUBLIC_KEY_PEM=\"" val "\""; next }
    { print }
  ' "$ENV_FILE" > "$tmp"
  mv "$tmp" "$ENV_FILE"
else
  {
    echo ""
    echo "# Product Ed25519 public key (auto-filled from config/license-public-key.pem on install)"
    printf 'LICENSE_PUBLIC_KEY_PEM="%s"\n' "$PUBLIC_KEY_ESCAPED"
  } >> "$ENV_FILE"
fi

echo "Set LICENSE_PUBLIC_KEY_PEM in ${ENV_FILE} from config/license-public-key.pem"
