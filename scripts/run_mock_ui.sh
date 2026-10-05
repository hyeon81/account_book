#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ui_dir="${project_root}/ui"

if [[ ! -f "${ui_dir}/package.json" ]]; then
  echo "UI project is not created yet: ${ui_dir}/package.json" >&2
  exit 1
fi

if [[ -n "${CODESPACE_NAME:-}" && -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]]; then
  export __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS="${CODESPACE_NAME}-5173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
fi

cd "${ui_dir}"
exec npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
