# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and other AI agents when working with code in this repository.

## Development Commands

- **Type checking**: `pnpm typecheck` (all workspaces via Turbo) or `pnpm w:app typecheck` (main app only) — run after making changes
- **Format checking**: `pnpm format:check` (required by CI); `pnpm format:changes` formats only files changed in git
- **Tests**: `pnpm test` (integration tests)
- **Workspaces**: use the `pnpm w:<name>` shortcuts defined in the root `package.json` scripts (e.g. `pnpm w:app`, `pnpm w:db`)
- **Dependencies**: add with `pnpm add <package> --filter <workspace-name>`; `pnpm deps:clean` / `pnpm deps:override` keep versions consistent

## Architecture Overview

Monorepo with `apps/`, `packages/`, and `services/` — directory names are self-describing; the non-obvious ones:

- **`apps/app`**: main Next.js frontend (App Router, React 19, Tailwind, Zustand)
- **`apps/api`**: Next.js server that hosts the tRPC API; the routers, procedures, and middleware live in `services/api` (`@op/api`)
- **`@op/common`** (`packages/common`): shared business logic and service layer
- **`@op/db`** (`services/db`): Drizzle ORM schema, migrations, and database client

## Key Technical Details

### UI Component System

- **Always prefer existing `@op/ui` components over vanilla html elements such as `<button>` or `<h2>`**
- **Always use design tokens** — never arbitrary Tailwind values (e.g. `text-[14px]`, `bg-[#333]`):
  - Colors: token-mapped Tailwind classes (e.g. `text-primary-teal`, `bg-neutral-gray1`) — source tokens in `packages/styles/tokens.css` (`--op-*`) mapped via `shared-styles.css`
  - Text sizes: the custom type scale (e.g. `text-title-lg`, `text-sm`) defined in `packages/styles/shared-styles.css` — no raw Tailwind size utilities we haven't defined
- Tailwind configuration is centralized in `@op/styles` (`packages/styles/shared-styles.css`)

### Database & tRPC

- After schema changes: run `pnpm w:db generate` to generate migrations
- **NEVER RUN `pnpm w:db migrate`** (migrations are applied by CI/CD, not locally)
- **Drizzle relations**: define new relations in `services/db/relations.ts` using the v2 `defineRelations` API (the source of truth for `db.query`). The v1 `relations()` blocks in individual `*.sql.ts` files still exist for legacy `db._query` callers but should **not** be added for new tables.
- **Row types**: derive a table's row type with `typeof <table>.$inferSelect` (e.g. `export type Foo = typeof foos.$inferSelect;`). Prefer this over `InferModel<typeof <table>>`.

## AI Assistant Guidelines

### File Search Scope

- **NEVER search outside the current worktree. Do not exit the current working directory.**
- The working directory is the root of the monorepo; do not traverse to parent directories or other projects

### Coding Conventions

- Never use `any` to fix type errors; avoid type assertions (`as` keyword)
- Always prefer suspense queries over a query with useEffect
- When using Suspense Queries, always add proper error boundaries
- **Component file structure**: Types and interfaces at the top, then the main exported component, then private sub-components and helper functions below. The primary export should be easy to find near the top of the file — don't bury it under utilities.
- **Never sort result sets in JavaScript when the database can `ORDER BY`.** Sorting in JS after a paginated fetch only orders the current page, so pagination silently breaks. If sort order depends on an aggregate (e.g. vote count), do the aggregate + `ORDER BY` in SQL — usually via a `LEFT JOIN` with `GROUP BY` — and have the caller follow the DB's order. JS-side sorts are only acceptable for fully in-memory, never-paginated data.

### Internationalization (i18n)

- **Translation files location**: `apps/app/src/lib/i18n/dictionaries/` — every `.json` file there is a supported language; keep them all in sync
- **Use `useTranslations` hook for client components**: `const t = useTranslations()` then `t('Key string')`
- **Use `TranslatedText` component** for server components
- **ALWAYS** wrap user-facing strings with `t('...')` — never hardcode user-facing text
- **For dynamic values**, use interpolation: `t('Hello {name}', { name: userName })` and `t.rich()` for strings that are broken up with styles/components

### Logging

- **Never log through `console.*`.** All logging must go through our loggers so it always reports to PostHog:
  - **Server** (services, `@op/common`, tRPC procedures, workflows): `import { logger } from '@op/logging'` — emits OpenTelemetry logs that ship to PostHog. Inside a tRPC procedure prefer `ctx.logger` (adds request context).
  - **Client / browser** (`apps/app`, `'use client'` code): `import { logger } from '@op/logging/client'` — reports to PostHog (`captureException` for `error`/`warn`) and also writes to the console.
- Use `logger.error(message, { error })` for caught errors (pass the caught error under the `error` key), and `logger.warn` / `logger.info` for everything else.

## Workflow Notes

- If you need to check interactions in the browser, you can use the Playwright MCP server and open http://localhost:3100 to open the dev server
- **Never start or kill the dev server on :3100** — it is shared with other agents and managed externally; verify changes statically or in the browser against the already-running server
- Authorization checks are achieved by our access-zones library. We usually get the profileUser and pass the user's roles to `assertAccess`
