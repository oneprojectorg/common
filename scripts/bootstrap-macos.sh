#!/usr/bin/env bash
# Bootstrap prerequisites for `pnpm docker:dev` on a fresh macOS system.
# Installs Homebrew (if missing), OrbStack, Node.js 22, and pnpm via corepack.
# OrbStack is the preferred macOS Docker runtime — lighter and faster than
# Docker Desktop, with a drop-in `docker` / `docker compose` CLI. If Docker
# Desktop or another daemon is already running, the install is skipped so we
# don't stack two runtimes.
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

# --- Container runtime (OrbStack preferred) ---------------------------------
# Detect any already-working docker daemon first — OrbStack, Docker Desktop,
# colima all expose the same `docker` CLI surface. If one is up, skip install.
if docker info >/dev/null 2>&1; then
  RUNTIME="existing"
  log "Docker daemon already reachable — skipping runtime install."
elif [[ -d "/Applications/OrbStack.app" ]]; then
  RUNTIME="orbstack"
  log "OrbStack already installed."
elif [[ -d "/Applications/Docker.app" ]]; then
  RUNTIME="docker-desktop"
  log "Docker Desktop already installed (consider switching to OrbStack: https://orbstack.dev)."
else
  RUNTIME="orbstack"
  log "Installing OrbStack via Homebrew cask…"
  brew install --cask orbstack
fi

# Launch the runtime if it isn't already serving requests.
if ! docker info >/dev/null 2>&1; then
  case "$RUNTIME" in
    orbstack)
      log "Launching OrbStack… (cold start is ~2–5s)"
      open -a OrbStack || die "Could not launch OrbStack.app. Open it manually, then re-run this script."
      ;;
    docker-desktop)
      log "Launching Docker Desktop… (may take 30–60s to fully start)"
      open -a Docker || die "Could not launch Docker.app. Open it manually, then re-run this script."
      ;;
    *)
      die "No container runtime found and none was installed. Install OrbStack (https://orbstack.dev) and re-run."
      ;;
  esac
  for i in {1..30}; do
    if docker info >/dev/null 2>&1; then log "Docker daemon is up."; break; fi
    sleep 5
  done
  docker info >/dev/null 2>&1 || die "Docker daemon didn't start within 150s. Launch it manually and re-run."
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

1. Confirm your container runtime has enough headroom — the stack idles at
   ~6–8 GB RAM with all 12 Supabase sub-containers.
   - OrbStack: auto-scales by default, no action needed. To cap or adjust,
     OrbStack → Settings → System → Memory limit.
   - Docker Desktop: Settings → Resources → Memory ≥ 8 GB.

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
