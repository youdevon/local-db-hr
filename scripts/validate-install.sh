#!/usr/bin/env bash
#
# Local DB HR — post-install / pre-release validation.
# Usage: npm run validate:install
#        bash scripts/validate-install.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

if [[ -f "$ROOT/.env.docker" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env.docker"
  set +a
fi

FAILURES=0

pass() {
  echo "OK: $1"
}

fail() {
  echo "FAIL: $1" >&2
  FAILURES=$((FAILURES + 1))
}

run_sql() {
  local sql="$1"
  if [[ -z "${DATABASE_URL:-}" ]]; then
    fail "DATABASE_URL is not set (required for database checks)"
    return 1
  fi
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "$sql"
}

echo "=== Local DB HR install validation ==="

if [[ -n "${LICENSE_PUBLIC_KEY_PEM:-}" ]]; then
  pass "LICENSE_PUBLIC_KEY_PEM is set"
else
  fail "LICENSE_PUBLIC_KEY_PEM is not set"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  fail "DATABASE_URL is not set"
else
  if ! command -v psql >/dev/null 2>&1; then
    fail "psql is required for database checks (install postgresql-client)"
  else
    if [[ "$(run_sql "SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm' LIMIT 1;" 2>/dev/null || true)" == "1" ]]; then
      pass "pg_trgm extension is available"
    else
      fail "pg_trgm extension is not installed (run sql/performance-indexes.sql)"
    fi

    if [[ "$(run_sql "SELECT to_regclass('public.employees') IS NOT NULL;" 2>/dev/null || true)" == "t" ]]; then
      pass "public.employees table exists"
    else
      fail "public.employees table is missing (run npx prisma migrate deploy and restore backup if needed)"
    fi

    UNIQUE_INDEX_COUNT="$(
      run_sql "
        SELECT COUNT(*)::text
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'app_settings'
          AND indexdef ILIKE '%UNIQUE%'
          AND indexdef ILIKE '%setting_key%';
      " 2>/dev/null || true
    )"
    if [[ "${UNIQUE_INDEX_COUNT:-0}" != "0" ]]; then
      pass "app_settings.setting_key has a unique index"
    else
      fail "app_settings.setting_key unique index is missing (run sql/performance-indexes.sql or prisma migrate deploy)"
    fi

    ADMIN_COUNT="$(
      run_sql "
        SELECT COUNT(*)::text
        FROM public.users u
        JOIN public.user_profiles p ON p.user_id = u.id
        WHERE u.is_active = true
          AND lower(p.role) = 'administrator';
      " 2>/dev/null || true
    )"
    if [[ "${ADMIN_COUNT:-0}" != "0" ]]; then
      pass "at least one active administrator user exists"
    else
      fail "no active administrator user found"
    fi
  fi
fi

echo ""
echo "Checking Prisma migration status..."
if npx prisma migrate status 2>&1 | tee /tmp/db-hr-migrate-status.txt; then
  if grep -qi "following migration.*not yet been applied\|Database schema is not up to date\|drift detected" /tmp/db-hr-migrate-status.txt; then
    fail "Prisma migrations are not fully applied (run npx prisma migrate deploy)"
  else
    pass "Prisma migrate status is clean"
  fi
else
  fail "Prisma migrate status check failed"
fi

echo ""
if [[ "$FAILURES" -eq 0 ]]; then
  echo "All install validation checks passed."
  exit 0
fi

echo "$FAILURES check(s) failed."
exit 1
