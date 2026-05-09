#!/usr/bin/env bash
#
# Local DB HR — controlled server-side update installation.
# Usage: bash scripts/install-update.sh /path/to/install-config.json
# Environment: DBHR_AUDIT_* set by caller; .env loaded from project root for Docker/DB.
#
set -euo pipefail

CONFIG_PATH="${1:?config json path required}"

command -v jq >/dev/null 2>&1 || { echo "jq is required"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "curl is required"; exit 1; }

ROOT="$(jq -r .projectRoot "$CONFIG_PATH")"
cd "$ROOT"

TARGET_VER="$(jq -r .targetVersion "$CONFIG_PATH")"
DOWNLOAD_URL="$(jq -r .downloadUrl "$CONFIG_PATH")"
RELEASE_TAG="$(jq -r .releaseTag "$CONFIG_PATH")"
EXPECTED_APP="$(jq -r .expectedAppName "$CONFIG_PATH")"
INSTALLED_AT_START="$(jq -r .installedVersionAtStart "$CONFIG_PATH")"

PKG_DIR="$(jq -r .paths.updatePackagesDir "$CONFIG_PATH")"
STAGING_DIR="$(jq -r .paths.updateStagingDir "$CONFIG_PATH")"
BACKUPS_ROOT="$(jq -r .paths.backupsUpdatesDir "$CONFIG_PATH")"
LOG_FILE="$(jq -r .paths.logFilePath "$CONFIG_PATH")"
STATUS_FILE="$(jq -r .statusFilePath "$CONFIG_PATH")"
LOCK_FILE="$(jq -r .lockFilePath "$CONFIG_PATH")"

mkdir -p "$PKG_DIR" "$STAGING_DIR" "$BACKUPS_ROOT" "$(dirname "$LOG_FILE")"

STARTED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
INSTALL_STARTED_AT="$STARTED_AT"

exec >> >(tee -a "$LOG_FILE") 2>&1

echo "=== install-update.sh starting at $STARTED_AT ==="

set -a
if [[ -f "$ROOT/.env" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/.env"
fi
set +a

export DBHR_PROJECT_ROOT="$ROOT"
export DBHR_AUDIT_ACTOR_USER_ID="$(jq -r .actorUserId "$CONFIG_PATH")"
export DBHR_AUDIT_ACTOR_EMAIL="$(jq -r .actorEmail // empty "$CONFIG_PATH")"
export DBHR_AUDIT_ACTOR_NAME="$(jq -r .actorName // empty "$CONFIG_PATH")"

log_audit() {
  local action="$1"
  local ok="${2:-true}"
  local reason="${3:-__NULL__}"
  local meta="${4:-{}}"
  node "$ROOT/scripts/log-update-audit.cjs" "$action" "$ok" "$reason" "$meta" || true
}

write_status() {
  local phase="$1"
  local finished="${2:-}"
  local succ="${3:-}"
  local err="${4:-}"
  local backup="${5:-}"
  jq -n \
    --arg phase "$phase" \
    --arg started "$INSTALL_STARTED_AT" \
    --arg updated "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
    --arg tv "$TARGET_VER" \
    --arg iv "$INSTALLED_AT_START" \
    --arg logrel "update-staging/install-update.log" \
    --arg finished "$finished" \
    --arg succ "$succ" \
    --arg err "$err" \
    --arg backup "$backup" \
    '{
      phase: $phase,
      startedAt: $started,
      updatedAt: $updated,
      finishedAt: (if ($finished|length)>0 then $finished else null end),
      success: (if ($succ|length)==0 then null elif $succ=="true" then true elif $succ=="false" then false else null end),
      error: (if ($err|length)>0 then $err else null end),
      backupPath: (if ($backup|length)>0 then $backup else null end),
      targetVersion: $tv,
      installedVersionAtStart: $iv,
      logFileRelative: $logrel
    }' > "${STATUS_FILE}.tmp"
  mv "${STATUS_FILE}.tmp" "$STATUS_FILE"
}

cleanup_lock() {
  rm -f "$LOCK_FILE" || true
}
trap cleanup_lock EXIT

BACKUP_PATH=""
MIGRATE_FAILED=""

fail_install() {
  local msg="$1"
  write_status "failed" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "false" "$msg" "${BACKUP_PATH:-}"
  log_audit "update_failed" "false" "$msg" "$(jq -n --arg m "$msg" --arg bp "${BACKUP_PATH:-}" '{error:$m,backupPath:$bp}')"
  echo "FAILED: $msg"
  exit 1
}

extract_installed_version() {
  local f="$1"
  if grep -qi '^Version:' "$f" 2>/dev/null; then
    grep -i '^Version:' "$f" | head -1 | sed -E 's/^Version:[[:space:]]*v?([0-9].*)/\1/' | tr -d '\r'
  else
    head -1 "$f" | sed 's/^v//' | tr -d '\r'
  fi
}

# --- Disk space (>= 512 MiB free) ---
avail_kb="$(df -Pk "$ROOT" 2>/dev/null | awk 'NR==2 {print $4}' || echo 0)"
if [[ "${avail_kb:-0}" -lt 524288 ]]; then
  fail_install "Insufficient free disk space on project volume (need at least 512 MiB)."
fi

if ! command -v docker >/dev/null 2>&1; then
  fail_install "Docker is required for server-side installation."
fi

if ! command -v npm >/dev/null 2>&1; then
  fail_install "npm is required on the server host for server-side installation."
fi

write_status "preparing_update"

write_status "downloading_package"
log_audit "update_package_download_started" "true" "__NULL__" "$(jq -n --arg url "$DOWNLOAD_URL" --arg tv "$TARGET_VER" '{downloadUrl:$url,targetVersion:$tv}')"

PKG_EXT=""
case "$DOWNLOAD_URL" in
  *.zip) PKG_EXT="zip" ;;
  *.tar.gz|*.tgz) PKG_EXT="tgz" ;;
  *)
    fail_install "Download URL must end with .zip or .tar.gz"
    ;;
esac

SAFE_TAG="${RELEASE_TAG//\//_}"
PKG_FILE="$PKG_DIR/release-${SAFE_TAG}.${PKG_EXT}"

if ! curl -fL --retry 3 --connect-timeout 30 --max-time 3600 -o "$PKG_FILE" "$DOWNLOAD_URL"; then
  log_audit "update_package_download_failed" "false" "curl_failed" "{}"
  fail_install "Download failed (curl)."
fi

if [[ ! -s "$PKG_FILE" ]]; then
  log_audit "update_package_download_failed" "false" "empty_file" "{}"
  fail_install "Downloaded package is empty."
fi

SZ="$(wc -c < "$PKG_FILE" | tr -d ' ')"
echo "Downloaded package: $PKG_FILE size=${SZ} bytes"
log_audit "update_package_download_completed" "true" "__NULL__" "$(jq -n --arg f "$PKG_FILE" --argjson sz "$SZ" '{packageFile:$f,sizeBytes:$sz}')"

write_status "validating_package"

EXTRACT_DIR="$STAGING_DIR/extract-$$"
rm -rf "$EXTRACT_DIR"
mkdir -p "$EXTRACT_DIR"

if [[ "$PKG_EXT" == "zip" ]]; then
  if unzip -l "$PKG_FILE" | awk 'NR>3 && NF>=4 {print $NF}' | grep -E '(^|/)\.\.(/|$)'; then
    log_audit "update_validation_failed" "false" "zip_path_traversal" "{}"
    fail_install "Unsafe path (..) detected in zip archive."
  fi
  unzip -q "$PKG_FILE" -d "$EXTRACT_DIR"
else
  if tar -tzf "$PKG_FILE" | grep -E '(^|/)\.\.(/|$)'; then
    log_audit "update_validation_failed" "false" "tar_path_traversal" "{}"
    fail_install "Unsafe path (..) detected in tar archive."
  fi
  tar -xzf "$PKG_FILE" -C "$EXTRACT_DIR"
fi

INNER="$(find "$EXTRACT_DIR" -mindepth 1 -maxdepth 1 -type d | head -1)"
if [[ -z "$INNER" ]]; then
  log_audit "update_validation_failed" "false" "no_root_folder" "{}"
  fail_install "Archive did not contain a root folder."
fi

validate_failed=""
[[ -f "$INNER/package.json" ]] || validate_failed="missing package.json"
[[ -f "$INNER/VERSION.txt" ]] || validate_failed="missing VERSION.txt"
[[ -d "$INNER/src" ]] || validate_failed="missing src/"
[[ -d "$INNER/prisma" ]] || validate_failed="missing prisma/"
[[ -f "$INNER/docker-compose.yml" ]] || validate_failed="missing docker-compose.yml"

if [[ -n "$validate_failed" ]]; then
  log_audit "update_validation_failed" "false" "$validate_failed" "{}"
  fail_install "Package validation failed: $validate_failed"
fi

PKG_NAME="$(jq -r .name "$INNER/package.json")"
if [[ "$PKG_NAME" != "local-db-hr" ]]; then
  log_audit "update_validation_failed" "false" "package_name_mismatch" "{}"
  fail_install "package.json name must be local-db-hr."
fi

# VERSION.txt: accept "Version: vx.y.z" or plain semver first line
RAW_VER="$(extract_installed_version "$INNER/VERSION.txt")"
RAW_VER="${RAW_VER#v}"
TARGET_STRIP="${TARGET_VER#v}"
if [[ "$RAW_VER" != "$TARGET_STRIP" ]]; then
  log_audit "update_validation_failed" "false" "version_mismatch" "{}"
  fail_install "VERSION.txt ($RAW_VER) does not match manifest target ($TARGET_STRIP)."
fi

log_audit "update_validation_passed" "true" "__NULL__" "$(jq -n --arg tv "$TARGET_VER" '{targetVersion:$tv}')"
log_audit "update_installation_started" "true" "__NULL__" "$(jq -n \
  --arg tv "$TARGET_VER" \
  --arg iv "$INSTALLED_AT_START" \
  --arg url "$DOWNLOAD_URL" \
  --arg tag "$RELEASE_TAG" \
  '{targetVersion:$tv,installedVersion:$iv,downloadUrl:$url,releaseTag:$tag}')"
write_status "backup_started"
log_audit "backup_started" "true" "__NULL__" "{}"

STAMP="$(date -u +"%Y-%m-%d_%H-%M")"
BACKUP_PATH="$BACKUPS_ROOT/${STAMP}_before_${TARGET_STRIP//[^a-zA-Z0-9._-]/_}"
mkdir -p "$BACKUP_PATH"

PG_USER="${POSTGRES_USER:-local_db_hr_user}"
PG_DB="${POSTGRES_DB:-local_db_hr}"

if ! docker compose -f "$ROOT/docker-compose.yml" exec -T db pg_dump -U "$PG_USER" "$PG_DB" > "$BACKUP_PATH/database.dump.sql" 2>/dev/null; then
  log_audit "backup_failed" "false" "pg_dump_failed" "{}"
  fail_install "Database backup (pg_dump) failed. Ensure Docker is running and the db service is healthy."
fi

if [[ ! -s "$BACKUP_PATH/database.dump.sql" ]]; then
  log_audit "backup_failed" "false" "empty_database_backup" "{}"
  fail_install "Database backup file missing or empty."
fi

tar -czf "$BACKUP_PATH/application-tree.tgz" \
  --exclude='./node_modules' \
  --exclude='./.next' \
  --exclude='./update-packages' \
  --exclude='./update-staging' \
  --exclude='./backups' \
  --exclude='./.git' \
  -C "$ROOT" .

if [[ ! -s "$BACKUP_PATH/application-tree.tgz" ]]; then
  log_audit "backup_failed" "false" "app_archive_missing" "{}"
  fail_install "Application backup archive missing or empty."
fi

[[ -f "$ROOT/.env" ]] && cp -a "$ROOT/.env" "$BACKUP_PATH/.env"
[[ -f "$ROOT/docker-compose.yml" ]] && cp -a "$ROOT/docker-compose.yml" "$BACKUP_PATH/docker-compose.yml"
[[ -f "$ROOT/package.json" ]] && cp -a "$ROOT/package.json" "$BACKUP_PATH/package.json"
[[ -f "$ROOT/VERSION.txt" ]] && cp -a "$ROOT/VERSION.txt" "$BACKUP_PATH/VERSION.txt"

if [[ -d "$ROOT/uploads" ]]; then
  tar -czf "$BACKUP_PATH/uploads.tgz" -C "$ROOT" uploads || true
fi

if [[ ! -f "$BACKUP_PATH/.env" ]]; then
  log_audit "backup_failed" "false" "missing_env_backup" "{}"
  fail_install ".env backup missing — refusing to continue."
fi

log_audit "backup_completed" "true" "__NULL__" "$(jq -n --arg p "$BACKUP_PATH" '{backupPath:$p}')"
write_status "backup_completed"

write_status "installing_files"

if command -v docker >/dev/null 2>&1; then
  docker compose -f "$ROOT/docker-compose.yml" stop app 2>/dev/null || true
fi

rsync -a \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude '.env.production' \
  --exclude 'uploads/' \
  --exclude 'backups/' \
  --exclude 'update-packages/' \
  --exclude 'update-staging/' \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude '.next/' \
  "$INNER/" "$ROOT/"

SYNC_VER="$(extract_installed_version "$ROOT/VERSION.txt")"
if [[ "$SYNC_VER" != "$TARGET_STRIP" ]]; then
  log_audit "update_validation_failed" "false" "version_mismatch_after_rsync" "{}"
  fail_install "After file copy, VERSION.txt ($SYNC_VER) does not match target ($TARGET_STRIP)."
fi

write_status "rebuilding_application"
log_audit "docker_rebuild_started" "true" "__NULL__" "{}"

if command -v npm >/dev/null 2>&1; then
  (cd "$ROOT" && npm ci) || {
    log_audit "update_failed" "false" "npm_ci_failed" "{}"
    fail_install "npm ci failed."
  }
fi

if command -v docker >/dev/null 2>&1; then
  docker compose -f "$ROOT/docker-compose.yml" build --no-cache app || {
    log_audit "update_failed" "false" "docker_build_failed" "$(jq -n --arg bp "$BACKUP_PATH" '{backupPath:$bp}')"
    fail_install "docker compose build --no-cache app failed."
  }
fi

write_status "database_migration_started"
log_audit "database_migration_started" "true" "__NULL__" "{}"

if command -v docker >/dev/null 2>&1; then
  docker compose -f "$ROOT/docker-compose.yml" up -d db 2>/dev/null || true
  sleep 5
  if ! docker compose -f "$ROOT/docker-compose.yml" run --rm app npx prisma migrate deploy; then
    MIGRATE_FAILED="yes"
    log_audit "update_failed" "false" "prisma_migrate_deploy_failed" "$(jq -n --arg bp "$BACKUP_PATH" '{backupPath:$bp}')"
  fi
fi

write_status "restarting_application"

if command -v docker >/dev/null 2>&1; then
  docker compose -f "$ROOT/docker-compose.yml" up -d 2>/dev/null || true
fi

write_status "verifying_update"
log_audit "verifying_update" "true" "__NULL__" "{}"

HC_OK="false"
if command -v docker >/dev/null 2>&1; then
  docker compose -f "$ROOT/docker-compose.yml" ps || true
  if docker compose -f "$ROOT/docker-compose.yml" ps app 2>/dev/null | grep -q 'Up'; then
    HC_OK="true"
  fi
fi

APP_URL_CHECK="${APP_URL:-http://localhost:3000}"
if command -v curl >/dev/null 2>&1; then
  if curl -sf --max-time 30 "${APP_URL_CHECK}/api/branding" >/dev/null 2>&1; then
    HC_OK="true"
  fi
fi

FINISHED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

if [[ "$MIGRATE_FAILED" == "yes" ]]; then
  MSG="Database migration failed. A backup was created at: $BACKUP_PATH. Manual rollback may be required."
  write_status "failed" "$FINISHED_AT" "false" "$MSG" "$BACKUP_PATH"
  META="$(jq -n --arg bp "$BACKUP_PATH" --arg m "$MSG" '{backupPath:$bp,error:$m,migrateFailed:true}')"
  log_audit "update_failed" "false" "$MSG" "$META"
  echo "$MSG"
  exit 1
fi

if [[ "$HC_OK" != "true" ]]; then
  MSG="Update failed. A backup was created at: $BACKUP_PATH. Manual rollback may be required."
  write_status "failed" "$FINISHED_AT" "false" "$MSG" "$BACKUP_PATH"
  META="$(jq -n --arg bp "$BACKUP_PATH" --arg m "$MSG" '{backupPath:$bp,error:$m}')"
  log_audit "update_failed" "false" "$MSG" "$META"
  echo "$MSG"
  exit 1
fi

write_status "completed" "$FINISHED_AT" "true" "" "$BACKUP_PATH"
log_audit "update_completed" "true" "__NULL__" "$(jq -n --arg bp "$BACKUP_PATH" --arg tv "$TARGET_VER" '{backupPath:$bp,targetVersion:$tv}')"

echo "=== install-update.sh finished OK at $FINISHED_AT ==="
exit 0
