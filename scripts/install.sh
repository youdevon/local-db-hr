#!/usr/bin/env bash
#
# Local DB HR first-time installation (host).
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker is required." >&2
  exit 1
fi

ENV_FILE="${ROOT}/.env"
ENV_EXAMPLE="${ROOT}/.env.docker.example"

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$ENV_EXAMPLE" ]]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    echo "Created ${ENV_FILE} from .env.docker.example — review passwords and secrets before production use."
  elif [[ -f "${ROOT}/.env.example" ]]; then
    cp "${ROOT}/.env.example" "$ENV_FILE"
    echo "Created ${ENV_FILE} from .env.example — review passwords and secrets before production use."
  else
    echo "ERROR: No .env.example or .env.docker.example found." >&2
    exit 1
  fi
fi

bash "${ROOT}/scripts/ensure-env-license-key.sh" "$ROOT"

echo "Building and starting Local DB HR..."
docker compose --env-file "$ENV_FILE" up -d --build

echo "Installation started. Check status with: docker compose ps"
echo "View app logs with: docker compose logs -f app"
