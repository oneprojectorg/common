# syntax=docker/dockerfile:1
# Base image: Node.js 22 LTS (slim variant for smaller image size)
FROM node:22-slim

# Install system dependencies needed by pnpm, Supabase CLI, and the app
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ca-certificates \
    unzip \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

# Enable corepack and install the exact pnpm version used in the monorepo
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Install Supabase CLI via the official binary (npm global install is not supported)
# NOTE: The supabase service container requires Docker socket passthrough so
# the CLI can manage its own Docker containers. In docker-compose.yml, add:
#   volumes:
#     - /var/run/docker.sock:/var/run/docker.sock
RUN ARCH=$(dpkg --print-architecture) && \
    case "$ARCH" in \
      amd64) SUPABASE_ARCH="linux_amd64" ;; \
      arm64) SUPABASE_ARCH="linux_arm64" ;; \
      *) echo "Unsupported architecture: $ARCH" && exit 1 ;; \
    esac && \
    curl -fsSL "https://github.com/supabase/cli/releases/download/v2.71.0/supabase_${SUPABASE_ARCH}.tar.gz" \
      -o /tmp/supabase.tar.gz && \
    tar -xzf /tmp/supabase.tar.gz -C /usr/local/bin supabase && \
    rm /tmp/supabase.tar.gz && \
    supabase --version

# Set working directory
WORKDIR /app

# ── Dependency layer (cached until lockfile or package.json files change) ──
# Copy root manifests and lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# Copy all workspace package.json files so pnpm can resolve the workspace graph
COPY apps/app/package.json ./apps/app/
COPY apps/api/package.json ./apps/api/
COPY configs/typescript-config/package.json ./configs/typescript-config/
COPY packages/analytics/package.json ./packages/analytics/
COPY packages/common/package.json ./packages/common/
COPY packages/core/package.json ./packages/core/
COPY packages/hooks/package.json ./packages/hooks/
COPY packages/logging/package.json ./packages/logging/
COPY packages/styles/package.json ./packages/styles/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
COPY services/api/package.json ./services/api/
COPY services/cache/package.json ./services/cache/
COPY services/collab/package.json ./services/collab/
COPY services/db/package.json ./services/db/
COPY services/emails/package.json ./services/emails/
COPY services/events/package.json ./services/events/
COPY services/realtime/package.json ./services/realtime/
COPY services/supabase/package.json ./services/supabase/
COPY services/translation/package.json ./services/translation/
COPY services/workflows/package.json ./services/workflows/
COPY tests/core/package.json ./tests/core/
COPY tests/e2e/package.json ./tests/e2e/

# Install all workspace dependencies using the frozen lockfile.
# TIPTAP_PRO_TOKEN is passed as a build secret (mounted at /run/secrets/tiptap_token)
# and exported into the environment for this layer only — never baked into the image.
RUN --mount=type=secret,id=tiptap_token \
    export TIPTAP_PRO_TOKEN=$(cat /run/secrets/tiptap_token) && \
    pnpm install --frozen-lockfile

# Source is bind-mounted at runtime via docker-compose (.:/app), so we
# intentionally do NOT COPY . . here — baking the repo into the image would
# add tens of GB and get immediately shadowed by the bind mount.

# Default command — overridden per-service in docker-compose.yml
CMD ["pnpm", "dev"]
