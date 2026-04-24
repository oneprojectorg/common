# Common Monorepo

Welcome to the **Common** project monorepo! This repository contains the source code for the main frontend application, the backend API, shared UI components, core utilities, and services. It's structured using [Turborepo](https://turbo.build/repo) and `pnpm` workspaces.
It's not quite ready to fork or contribute to yet as we are working fast on it but soon!

## Quick Start & Setup

1.  **Prerequisites**:
    - Ensure you have **Node.js v22+** installed. You can use [nvm](https://github.com/nvm-sh/nvm) for easy Node.js version management: `nvm use`
    - Enable [Corepack](https://nodejs.org/api/corepack.html) (Node.js's built-in package manager manager) by running: `corepack enable` (This ensures you use the `pnpm` version specified in the root `package.json`).
2.  **Install Dependencies**: Run `pnpm install` in the project root. This will install dependencies for all workspaces.
3.  **Environment Variables**:
    - Copy the example environment file: `cp .env.example .env.local`
    - Fill in the necessary values in `.env.local`, especially for Supabase (URL, anon key, service role key) and Resend (API key for emails). You can get these from your Supabase project settings and Resend account.
4.  **Local Development Database**:
    - Start the local Supabase stack (PostgreSQL database, etc.): `pnpm w:db start`. This uses the Supabase CLI, make sure Docker is running.
    - Apply database migrations: `pnpm w:db migrate`.
5.  **Run Applications** (using your `w:` shorthand):
    - **Frontend App (`apps/app`)**: `pnpm w:app dev` (Usually runs on [http://localhost:3100](http://localhost:3100))
    - **API Server (`apps/api`)**: `pnpm w:api dev` (Usually runs on [http://localhost:3300](http://localhost:3300))
    - **UI Storybook (`packages/ui`)**: `pnpm w:ui dev` (Usually runs on [http://localhost:3600](http://localhost:3600))
    - **Email Previews (`services/emails`)**: `pnpm w:emails dev` (Usually runs on [http://localhost:3883](http://localhost:3883))

## Docker Dev Environment

A fully containerised dev environment is available via `docker-compose.dev.yml`. It runs the Next.js app, the tRPC API, Supabase (via Docker-in-Docker), and Redis — all with hot-reload.

### Prerequisites

On a fresh machine, you can install everything below with one of the bootstrap scripts:

```bash
scripts/bootstrap-macos.sh    # Homebrew + Docker Desktop + Node 22 + pnpm
scripts/bootstrap-linux.sh    # Docker engine + Node 22 + pnpm (Debian/Ubuntu)
```

Otherwise, install these manually:

- **Docker Desktop** (or OrbStack / colima) running — give it enough headroom: the stack steady-states at **~6–8 GB RAM** (DinD + ~12 Supabase sub-containers + the Next.js app + API + Redis).
- **Disk space** — budget **~15–20 GB** for the base image, the DinD volume (Supabase images cached inside it), `node_modules` volumes, and Next.js build caches.
- **Node.js 22+** and **pnpm** (via `corepack enable`) — the `pnpm docker:dev` script invokes compose; if you only want the raw `docker compose up` path, Node/pnpm aren't strictly required.
- **`TIPTAP_PRO_TOKEN`** — set it in your shell before running, or put it in `.env.local` at the repo root (`.env.local` is sourced by your workflow; `.env.docker` is tracked and must not contain the real token).
- **Platform** — tested on arm64 macOS. amd64 Linux should work but isn't verified in CI.

### Starting the dev server

```bash
pnpm docker:dev
```

**First boot: 5–15 min.** The `supabase` service pulls ~12 images into the DinD daemon on first run. The `app` / `api` services additionally run `pnpm install --frozen-lockfile` into their named volumes. Subsequent starts are much faster because the image layers, `dind_storage`, and `node_modules` volumes all persist.

If the first `supabase start` flakes (occasionally the Deno edge-runtime init trips on a transient `deno.land` fetch), `Ctrl-C` and re-run — the second attempt uses cached images and almost always succeeds.

**Custom port prefix** — if the default ports conflict with another running stack, override `PORT_PREFIX`:

```bash
PORT_PREFIX=40 pnpm docker:dev   # app → 4000, api → 4001, supabase → 4021
```

### Default ports

| Service           | Port  | URL                         |
|-------------------|-------|-----------------------------|
| Next.js app       | 3100  | http://localhost:3100       |
| tRPC API          | 3101  | http://localhost:3101       |
| Supabase API      | 3121  | http://localhost:3121       |
| Supabase DB       | 3122  | `postgres://postgres:postgres@localhost:3122/postgres` |
| Supabase Studio   | 3123  | http://localhost:3123       |
| Mailpit (email)   | 3124  | http://localhost:3124       |

Ports are derived from `PORT_PREFIX` (default `31`): `{PREFIX}00`, `{PREFIX}01`, etc.

- **Supabase Studio** — the Supabase web dashboard (table editor, SQL editor, auth inspector, storage browser). Auto-connects to the local dev DB, no login.
- **Mailpit** — captures all outbound email from the local Supabase auth service. Magic-link and OTP emails land here in dev.

### Running multiple instances

Each `PORT_PREFIX` value produces a fully isolated stack (containers, volumes, and network are all namespaced by the project name `op-{PREFIX}`):

```bash
PORT_PREFIX=31 pnpm docker:dev   # default instance
PORT_PREFIX=40 pnpm docker:dev   # second instance, no conflicts
```

**Image cache behaviour across instances:**

- **App/API build cache** — Docker's layer cache is global, so building for a new `PORT_PREFIX` reuses all cached layers and is nearly instant.
- **Supabase images inside DinD** — each instance has its own `dind_storage` volume (two DinD daemons cannot safely share `/var/lib/docker`). The first start of a new instance will re-pull Supabase sub-images (~5–10 min). Subsequent restarts of the same instance are fast because the cache persists in its volume.

To stop a specific instance, pass the same `PORT_PREFIX`:

```bash
PORT_PREFIX=40 pnpm docker:down
```

### Rebuilding images

If you change the `Dockerfile` or add/remove dependencies from `package.json`:

```bash
pnpm docker:dev:build
```

### Stopping

```bash
pnpm docker:down
```

### Environment variables

The docker environment reads from `.env.docker`. A committed version with safe local-dev defaults is included — you generally don't need to change anything to get started. If you need to customise values, copy the example file:

```bash
cp .env.docker.example .env.docker
```

Key variables:

| Variable | Purpose |
|---|---|
| `PORT_PREFIX` | First two digits of all exposed ports (default `31`) |
| `TIPTAP_PRO_TOKEN` | Required to install the Tiptap Pro packages |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-facing Supabase URL (set automatically by compose) |
| `SUPABASE_URL` | Internal Docker network URL for server-side Supabase access |

### Dev database + seeding

The dev Postgres runs inside the DinD daemon (the Supabase CLI spawns it). The Next.js app and tRPC API connect to it over the internal docker network at `dind:54322`; from your host, it's exposed on `localhost:3122` (see port table above).

**Migrations and seeds run automatically** on every `api` container start — the compose `command` chain is:

```sh
pnpm install --frozen-lockfile \
 && pnpm w:db migrate \
 && tsx services/db/seed-access-control.ts \
 && pnpm -C ./apps/api dev
```

`seed-access-control.ts` is the Docker-dev seed (the full `seed.ts` has a DB-URL allowlist that excludes dind). It's idempotent and handles:

- Access-control zones, roles, and permissions.
- A default **"One Project"** organization + profile.
- `onboardedAt` backfill for admin users (prevents the `/start` redirect loop).
- Linking admin users to the default organization with the `Admin` role.

**Manual control** if you need to re-run:

```bash
pnpm docker:migrate   # run drizzle migrations against the dev DB
pnpm docker:seed      # re-run the Docker-dev seed
```

The seed is safe to re-run at any time; every step uses `onConflictDoNothing` or existence checks.

### Reducing disk footprint

**If you use docker-dev exclusively (not `pnpm dev` on host),** you can reclaim **~1.5–2 GB** by deleting host-side workspace `node_modules`. The container hides these behind a `nocopy` named volume, so they are unused dead weight on the host. Root-level `node_modules` is still needed on the host for IDE type-checking.

```bash
rm -rf apps/app/node_modules apps/api/node_modules
```

If you later want to run workspaces on the host, `pnpm install` from the repo root restores them.

**Clean up stale `PORT_PREFIX` stacks.** Each prefix has its own ~5 GB `dind_storage` volume (Supabase images cached inside its DinD daemon — they can't be shared). If you experimented with `PORT_PREFIX=40` once and moved on, that volume is still sitting there:

```bash
docker compose -f docker-compose.dev.yml -p op-40 down -v
```

**Prune Turbopack caches when they get fat.** The `app_next` and `api_next` volumes grow unbounded. Remove them when disk gets tight; the next boot rebuilds them:

```bash
docker volume rm op-31_app_next op-31_api_next
```

## Monorepo Structure

This monorepo is organized into several distinct workspaces:

### Applications (`apps/`)

These are the deployable units of the project.

- **[`apps/app`](./apps/app/README.md)**: The main user-facing frontend web application built with Next.js (App Router), React, Tailwind CSS, and Zustand. It communicates with the backend via tRPC.
- **[`apps/api`](./apps/api/README.md)**: A Next.js application that hosts the tRPC API endpoint (`/api/v1/trpc/[trpc]`) and serves API documentation (OpenAPI spec at `/api/v1/openapi.json` and an interactive UI at `/`).

### Packages (`packages/`)

Shared libraries used across different applications and services.

- **[`packages/core`](./packages/core/README.md)**: Foundational layer providing shared configuration (`config.ts`), constants, environment logic, URL generation, and a custom logger (`fulog.ts`).
- **[`packages/hooks`](./packages/hooks/README.md)**: Reusable React hooks, including authentication hooks (`useAuthUser`, `useAuthLogout`) interacting with Supabase, and potentially data fetching hooks using `@tanstack/react-query`.
- **[`packages/ui`](./packages/ui/README.md)**: The core UI component library built with React Aria Components, styled with Tailwind CSS and `tailwind-variants`. Includes a Storybook setup for component development and documentation.

### Services (`services/`)

Backend services and utilities, often consumed by the applications.

- **[`services/db`](./services/db/README.md)**: Manages the PostgreSQL database schema using Drizzle ORM, handles migrations (`drizzle-kit`), provides the typed database client, and integrates with the local Supabase development environment. Includes a custom workflow for managing database indexes separately.
- **[`services/emails`](./services/emails/README.md)**: Defines transactional email templates using React Email and Tailwind CSS. Provides a function (`OPNodemailer`) to render and send emails via Nodemailer/Resend SMTP. (Note: Currently, the sending function doesn't seem to be actively used by other services).
- **[`services/supabase`](./services/supabase/README.md)**: Provides configured Supabase client instances (browser and server-side using `@supabase/ssr`) and utilities for interacting with Supabase authentication and storage. Manages TypeScript type generation (`pnpm typegen`) from the database schema.
- **[`services/trpc`](./services/trpc/README.md)**: Implements the type-safe API layer using tRPC. Defines routers, procedures, context (`createContext`), middleware, and provides the `TRPCProvider` for frontend integration with React Query and localStorage persistence. Also includes integration with the AI SDK (Anthropic).

### Configuration (`configs/`)

Shareable configurations for tooling.

- **[`configs/typescript-config`](./configs/typescript-config/README.md)**: Shared TypeScript `tsconfig.json` base files (`base.json`, `nextjs.json`, `react-library.json`, etc.) to ensure consistent compiler options.

## Development Workflow

_(Commands below assume usage of the `w:<workspace>` shorthand)_

- **Code Generation**:
  - After modifying the database schema (`services/db/schema/tables/*.sql`), run `pnpm w:db generate` to create SQL migrations and extract indexes.
  - Apply migrations by running `pnpm w:db migrate`.
  - Generate Supabase types by running `pnpm w:supabase typegen`.
- **Type Checking**: Run `pnpm typecheck` to type-check all workspaces, or `pnpm w:<workspace> typecheck` (e.g., `pnpm w:app typecheck`) for a specific workspace.
- **Running Specific Workspaces**: Use `pnpm w:<workspace> <script>` (e.g., `pnpm w:app dev`). Workspace names (`app`, `api`, `ui`, `core`, `hooks`, `db`, `emails`, `supabase`, `trpc`) correspond to the directories.
- **Adding Dependencies**: Use `pnpm add <package-name> --filter <workspace-name>` (e.g., `pnpm add zod --filter @op/core`). For dev dependencies, use `-D`. (Note: Using `--filter` is recommended when adding dependencies from the root to ensure the `package.json` is updated correctly).

## Tailwind Integration Details

This monorepo utilizes a shared Tailwind configuration strategy managed primarily by the `@op/ui` package.

- **Shared Config**: `@op/ui` exports a base Tailwind configuration (`@op/ui/tailwind-config`) and shared color definitions from `@op/core`.
- **Utilities**: `@op/ui` provides utilities (`@op/ui/tailwind-utils`) like `withUITailwindPreset` and `withTranspiledWorkspacesForNext`.
- **App Consumption**: Applications (`apps/app`, `apps/api`) wrap their `tailwind.config.ts` with `withUITailwindPreset` and their `next.config.mjs` with `withTranspiledWorkspacesForNext`. This automatically includes the shared preset and ensures Next.js transpiles the necessary packages (`@op/ui` and any others listed in `@op/ui/tailwind-utils`) so Tailwind can scan their class usage directly from source.

This setup allows components in `@op/ui` (and potentially other packages) to use Tailwind classes without having Tailwind as a direct dependency, centralizing the configuration and build process in the consuming applications. See the [`@op/ui` README](./packages/ui/README.md) and the utilities in `@op/ui/tailwind-utils` for more details if adding new Tailwind-dependent packages.

## Dependency Management Scripts

The root `package.json` includes several scripts prefixed with `deps:` to help manage dependencies across the monorepo:

- **`pnpm deps:clean`**: Runs `depcheck` on all workspaces (`apps/*`, `packages/*`, `services/*`) and automatically removes any unused dependencies listed in their respective `package.json` files. It then formats all `package.json` files. **Important:** Ensure you have no uncommitted/staged changes before running, as it modifies `package.json` files directly.
  - **Note**: This script incorrectly removes certain **Storybook** addons and plugins. Double check before committing.
- **`pnpm deps:override`**: Identifies external dependencies used in two or more workspaces. If such a dependency is not already present in the root `package.json`, this script adds it to the root `devDependencies` and creates a corresponding entry in `pnpm.overrides`. This enforces version consistency for shared dependencies across the monorepo. It then formats all `package.json` files. **Important:** Ensure you have no uncommitted/staged changes before running.
- **`pnpm deps:viz`**: Generates an interactive D3.js visualization of the Turborepo task dependency graph (based on the `build` task) and opens it automatically in your default browser. Useful for understanding the relationships and build order between workspaces.

