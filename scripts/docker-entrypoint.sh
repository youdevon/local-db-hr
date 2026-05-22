#!/usr/bin/env bash
#
# Local DB HR container startup:
# 1. DB health check
# 2. CREATE EXTENSION pg_trgm
# 3. prisma migrate deploy
# 4. seed admin
# 5. start app
#
set -euo pipefail

cd /app

if [[ -z "${LICENSE_PUBLIC_KEY_PEM:-}" ]] && [[ -f /app/config/license-public-key.pem ]]; then
  export LICENSE_PUBLIC_KEY_PEM="$(tr -d '\r' < /app/config/license-public-key.pem)"
fi

if [[ -z "${LICENSE_PUBLIC_KEY_PEM:-}" ]]; then
  echo "ERROR: LICENSE_PUBLIC_KEY_PEM is not set." >&2
  echo "Set LICENSE_PUBLIC_KEY_PEM in .env or run scripts/ensure-env-license-key.sh on the host." >&2
  exit 1
fi

DB_HOST="${POSTGRES_HOST:-db}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-local_db_hr_user}"
DB_NAME="${POSTGRES_DB:-local_db_hr}"
DB_PASSWORD="${POSTGRES_PASSWORD:-}"

if [[ -n "$DB_PASSWORD" ]]; then
  export PGPASSWORD="$DB_PASSWORD"
fi

echo "[entrypoint] Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
for i in $(seq 1 60); do
  if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    echo "[entrypoint] PostgreSQL is ready."
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    echo "ERROR: PostgreSQL did not become ready in time." >&2
    exit 1
  fi
  sleep 2
done

echo "[entrypoint] Ensuring pg_trgm extension..."
PSQL_DATABASE_URL="${DATABASE_URL%%\?*}"
psql "$PSQL_DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"

echo "[entrypoint] Running prisma migrate deploy..."
npx prisma migrate deploy

echo "[entrypoint] Seeding default administrator (if needed)..."
node /app/scripts/seed-admin.cjs

echo "[entrypoint] Starting application..."
exec npm start
