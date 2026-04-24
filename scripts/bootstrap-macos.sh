#!/usr/bin/env bash
# Bootstrap prerequisites for `pnpm docker:dev` on a fresh macOS system.
# Installs Homebrew (if missing), Docker Desktop, Node.js 22, and pnpm via corepack.
# Tested on macOS 14+ (Sonoma / Sequoia), Apple Silicon and Intel.
# Idempotent: safe to re-run.

set -euo pipefail

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31m!!\033[0m %s\n' "$*" >&2; exit 1; }

# --- Preflight ----------------------------------------------------------------
[[ "$(uname -s)" == "Darwin" ]] || die "This script is macOS-only. Use bootstrap-linux.sh on Linux."

# --- Homebrew ----------------------------------------------------------------
if command -v brew >/dev/null; then
  log "Homebrew present: $(brew --version | head -1)"
else
  log "Installing Homebrew…"
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Apple Silicon installs brew to /opt/homebrew; wire it up for this shell.
  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
  command -v brew >/dev/null || die "Homebrew installed but 'brew' still not on PATH. Open a new shell and re-run."
fi

# --- Docker Desktop (cask) ---------------------------------------------------
if [[ -d "/Applications/Docker.app" ]]; then
  log "Docker Desktop already installed."
else
  log "Installing Docker Desktop via Homebrew cask…"
  # The cask was renamed from 'docker' to 'docker-desktop' a few years back;
  # try the new name first, fall back to the legacy alias.
  if brew info --cask docker-desktop >/dev/null 2>&1; then
    brew install --cask docker-desktop
  else
    brew install --cask docker
  fi
fi

# Ensure Docker Desktop is running — the CLI talks to it via /var/run/docker.sock.
if docker info >/dev/null 2>&1; then
  log "Docker Desktop is running."
else
  log "Launching Docker Desktop… (may take 30–60s to fully start)"
  open -a Docker || die "Could not launch Docker.app. Open it manually, then re-run this script."
  for i in {1..20}; do
    if docker info >/dev/null 2>&1; then log "Docker is up."; break; fi
    sleep 5
  done
  docker info >/dev/null 2>&1 || die "Docker Desktop didn't start within 100s. Launch it manually and re-run."
fi

# --- Node.js 22 ---------------------------------------------------------------
NODE_MAJOR=0
if command -v node >/dev/null; then
  NODE_MAJOR=$(node -v | sed -E 's/v([0-9]+).*/\1/')
fi

if [[ "$NODE_MAJOR" -ge 22 ]]; then
  log "Node.js $(node -v) already installed."
else
  log "Installing Node.js 22 via Homebrew…"
  brew install node@22
  # node@22 is keg-only; link it onto PATH.
  brew link --overwrite --force node@22
fi

# --- Corepack + pnpm ---------------------------------------------------------
log "Enabling corepack and pinning pnpm@9.15.4 (matches packageManager field)…"
corepack enable
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

1. In Docker Desktop → Settings → Resources, bump Memory to at least 8 GB
   (the stack idles at ~6–8 GB RAM with all 12 Supabase sub-containers).

2. Create .env.local if you don't already have one:
     cp ${REPO_ROOT}/.env.local.example ${REPO_ROOT}/.env.local
   Then edit it and set TIPTAP_PRO_TOKEN (required — ask a teammate).

3. Source .env.local so TIPTAP_PRO_TOKEN reaches the docker build:
     set -a; source ${REPO_ROOT}/.env.local; set +a

4. Start the dev stack:
     pnpm docker:dev:build    # first time only — builds the image (5–15 min)
     pnpm docker:dev          # subsequent runs

5. Once ready, open:
   - App:              http://localhost:3100
   - Supabase Studio:  http://localhost:3123
   - Mailpit (email):  http://localhost:3124
EOF
