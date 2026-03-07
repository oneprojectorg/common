# syntax=docker/dockerfile:1
# Base image: Node.js 22 LTS (slim variant for smaller image size)
FROM node:22-slim

# Install system dependencies needed by pnpm, Supabase CLI, and the app
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ca-certificates \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Enable corepack and install the exact pnpm version used in the monorepo
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Install Supabase CLI via the official npm package
# NOTE: The supabase service container requires Docker socket passthrough so
# the CLI can manage its own Docker containers. In docker-compose.yml, add:
#   volumes:
#     - /var/run/docker.sock:/var/run/docker.sock
RUN npm install -g supabase@2.71.0

# Set working directory
WORKDIR /app

# ── Dependency layer (cached until lockfile or package.json files change) ──
# Copy root manifests and lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

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

# Install all workspace dependencies using the frozen lockfile
RUN pnpm install --frozen-lockfile

# ── Source layer ──
# Copy the rest of the source code.
# In development, the repo root is bind-mounted over /app so changes are
# reflected immediately without rebuilding the image.
COPY . .

# Default command — overridden per-service in docker-compose.yml
CMD ["pnpm", "dev"]
