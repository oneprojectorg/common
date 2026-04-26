#!/usr/bin/env bash
# Runs once when the devcontainer is built / rebuilt.
# Idempotent: safe to re-run.
set -euo pipefail

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }

# --- Corepack + pnpm ---------------------------------------------------------
log "Enabling corepack and pinning pnpm@9.15.4 (matches packageManager field)"
sudo corepack enable
corepack prepare pnpm@9.15.4 --activate

# --- Supabase CLI ------------------------------------------------------------
# The Supabase CLI is distributed as a self-contained binary; npm install -g
# is not supported. Pin to the same version as the Dockerfile.
SUPABASE_VERSION="2.71.0"
if ! command -v supabase >/dev/null || [[ "$(supabase --version 2>/dev/null)" != "$SUPABASE_VERSION" ]]; then
  log "Installing Supabase CLI v${SUPABASE_VERSION}"
  ARCH=$(dpkg --print-architecture)
  case "$ARCH" in
    amd64) SUPABASE_ARCH="linux_amd64" ;;
    arm64) SUPABASE_ARCH="linux_arm64" ;;
    *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
  esac
  curl -fsSL "https://github.com/supabase/cli/releases/download/v${SUPABASE_VERSION}/supabase_${SUPABASE_ARCH}.tar.gz" -o /tmp/supabase.tar.gz
  sudo tar -xzf /tmp/supabase.tar.gz -C /usr/local/bin supabase
  rm /tmp/supabase.tar.gz
fi
supabase --version

# --- Claude Code -------------------------------------------------------------
if ! command -v claude >/dev/null; then
  log "Installing Claude Code globally"
  sudo npm install -g @anthropic-ai/claude-code
fi
claude --version || true

# --- .env.local --------------------------------------------------------------
# Seed a local env file from the example so `pnpm dev` works on first boot.
# Real secrets (TIPTAP_PRO_TOKEN, ANTHROPIC_API_KEY) come in via Codespaces
# secrets / remoteEnv — see devcontainer.json.
if [[ ! -f .env.local ]]; then
  log "Creating .env.local from .env.local.example"
  cp .env.local.example .env.local
fi

# --- pnpm install ------------------------------------------------------------
log "Installing workspace dependencies"
# Don't fail the whole post-create on a transient install hiccup; user can rerun.
if [[ -n "${TIPTAP_PRO_TOKEN:-}" ]]; then
  pnpm install --frozen-lockfile || pnpm install
else
  echo "WARNING: TIPTAP_PRO_TOKEN is not set. @tiptap-pro packages will fail to install." >&2
  echo "  Set it as a Codespaces user secret, then rebuild this container." >&2
  pnpm install --frozen-lockfile || pnpm install || true
fi

# --- Playwright browsers + system deps ---------------------------------------
# Installs Chromium plus the Debian packages it needs (fonts, libnss3, etc.).
# `--with-deps` runs apt-get under the hood, so we need sudo.
log "Installing Playwright Chromium + system dependencies"
sudo -E pnpm exec playwright install --with-deps chromium || \
  sudo -E npx -y playwright@latest install --with-deps chromium

log "Devcontainer post-create complete."
cat <<'EOF'

Next steps inside the container:
  1. Make sure these Codespaces user secrets are set (Settings -> Codespaces):
       - TIPTAP_PRO_TOKEN (required for @tiptap-pro packages)
       - ANTHROPIC_API_KEY (optional, lets Claude Code skip the OAuth flow)
  2. Run `claude` to start Claude Code.
  3. Ask Claude to start the dev stack, e.g.:
       "Start Supabase, run migrations, then start the app and api in the background."
     Typical commands it will run:
       pnpm w:db start
       pnpm w:db migrate
       pnpm w:app dev   # Next.js  -> http://localhost:3100
       pnpm w:api dev   # tRPC API -> http://localhost:3300
EOF
