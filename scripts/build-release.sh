#!/usr/bin/env bash
#
# Build a release archive for remote installation.
# Includes prisma/migrations; never bundles license signing private keys.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION="$(tr -d '\r\n' < VERSION.txt | sed -E 's/^Version:[[:space:]]*//; s/^v//')"
SAFE_VERSION="${VERSION//\//_}"
OUT_DIR="${ROOT}/releases"
ARCHIVE="${OUT_DIR}/local-db-hr-${SAFE_VERSION}.tar.gz"

mkdir -p "$OUT_DIR"

if [[ -f "${ROOT}/tools/license-generator/keys/license-private.pem" ]]; then
  echo "WARNING: Private signing key exists locally but will NOT be included in the release archive."
fi

tar -czf "$ARCHIVE" \
  --exclude='./node_modules' \
  --exclude='./.next' \
  --exclude='./.git' \
  --exclude='./backups' \
  --exclude='./uploads' \
  --exclude='./update-packages' \
  --exclude='./update-staging' \
  --exclude='./releases' \
  --exclude='./DB-HR-upgraded' \
  --exclude='./tools/license-generator/keys' \
  --exclude='./tools/license-generator/.env' \
  --exclude='./.env' \
  --exclude='./.env.docker' \
  --exclude='./.env.local' \
  --exclude='./.env.production' \
  --exclude='*.tar.gz' \
  --exclude='*.zip' \
  --exclude='*.dump' \
  --exclude='*.sql' \
  -C "$ROOT" .

echo "Release archive: $ARCHIVE"
echo "Included: prisma/migrations, config/license-public-key.pem, scripts/, docker-compose.yml, Dockerfile"
echo "Excluded: tools/license-generator/keys/ (private signing keys)"
