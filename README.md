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

- **[`configs/eslint-config`](./configs/eslint-config/README.md)**: Shared ESLint configurations (`base.js`, `next.js`, etc.) to enforce consistent code style and quality. The `next.js` config is widely used across workspaces.
- **[`configs/typescript-config`](./configs/typescript-config/README.md)**: Shared TypeScript `tsconfig.json` base files (`base.json`, `nextjs.json`, `react-library.json`, etc.) to ensure consistent compiler options.

## Development Workflow

_(Commands below assume usage of the `w:<workspace>` shorthand)_

- **Code Generation**:
  - After modifying the database schema (`services/db/schema/tables/*.sql`), run `pnpm w:db generate` to create SQL migrations and extract indexes.
  - Apply migrations by running `pnpm w:db migrate`.
  - Generate Supabase types by running `pnpm w:supabase typegen`.
- **Linting**: Run `pnpm lint` in the root to lint all workspaces, or `pnpm w:<workspace> lint` (e.g., `pnpm w:app lint`) to lint a specific workspace.
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

