#!/usr/bin/env bash
# Bootstrap prerequisites for `pnpm docker:dev` on a fresh Debian/Ubuntu system.
# Installs Docker (engine + compose plugin), Node.js 22, and pnpm via corepack.
# Idempotent: safe to re-run.
#
# For Fedora/RHEL/Arch: install Docker and Node 22 manually with your package
# manager, then run `sudo corepack enable && corepack prepare pnpm@9.15.4 --activate`.

set -euo pipefail

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31m!!\033[0m %s\n' "$*" >&2; exit 1; }

# --- Preflight ----------------------------------------------------------------
[[ "$(uname -s)" == "Linux" ]] || die "This script is Linux-only. Use bootstrap-macos.sh on macOS."
[[ "${EUID}" -ne 0 ]] || die "Run as a regular user, not root. The script will sudo for the steps that need it."
command -v sudo >/dev/null || die "sudo is required but not installed."
command -v curl >/dev/null || die "curl is required. Install it first (e.g. 'sudo apt-get install -y curl')."

[[ -r /etc/os-release ]] || die "/etc/os-release missing; cannot detect distro."
# shellcheck disable=SC1091
. /etc/os-release
case "${ID_LIKE:-$ID}" in
  *debian*|debian|ubuntu) ;;
  *) die "Unsupported distro ($ID). This script targets Debian/Ubuntu derivatives." ;;
esac

# --- Docker engine + compose plugin ------------------------------------------
if command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then
  log "Docker already installed: $(docker --version)"
else
  log "Installing Docker via the official get.docker.com convenience script…"
  curl -fsSL https://get.docker.com | sudo sh
fi

# Add current user to the docker group so 'docker' works without sudo.
if id -nG "$USER" | tr ' ' '\n' | grep -qx docker; then
  log "User '$USER' already in docker group."
else
  log "Adding '$USER' to the docker group (takes effect after re-login)…"
  sudo usermod -aG docker "$USER"
  NEEDS_RELOGIN=1
fi

# --- Node.js 22 ---------------------------------------------------------------
NODE_MAJOR=0
if command -v node >/dev/null; then
  NODE_MAJOR=$(node -v | sed -E 's/v([0-9]+).*/\1/')
fi

if [[ "$NODE_MAJOR" -ge 22 ]]; then
  log "Node.js $(node -v) already installed."
else
  log "Installing Node.js 22 via NodeSource…"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# --- Corepack + pnpm ---------------------------------------------------------
log "Enabling corepack and pinning pnpm@9.15.4 (matches packageManager field)…"
sudo corepack enable
corepack prepare pnpm@9.15.4 --activate

# --- Verify ------------------------------------------------------------------
log "Installed versions:"
docker --version
docker compose version
node --version
pnpm --version

# --- Next steps --------------------------------------------------------------
BOLD=$(tput bold 2>/dev/null || true)
RESET=$(tput sgr0 2>/dev/null || true)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cat <<EOF

${BOLD}Next steps:${RESET}

$([[ "${NEEDS_RELOGIN:-0}" == "1" ]] && echo "0. Log out and back in (or run 'newgrp docker') so group changes apply.")
1. Create .env.local if you don't already have one:
     cp ${REPO_ROOT}/.env.local.example ${REPO_ROOT}/.env.local
   Then edit it and set TIPTAP_PRO_TOKEN (required — ask a teammate).

2. Source .env.local so TIPTAP_PRO_TOKEN reaches the docker build:
     set -a; source ${REPO_ROOT}/.env.local; set +a

3. Start the dev stack:
     pnpm docker:dev:build    # first time only — builds the image (5–15 min)
     pnpm docker:dev          # subsequent runs

4. Once ready, open:
   - App:              http://localhost:3100
   - Supabase Studio:  http://localhost:3123
   - Mailpit (email):  http://localhost:3124
EOF
