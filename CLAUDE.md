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

Architecture decisions are recorded as ADRs — the numbered files matching `docs/adr/[0-9]*.md`. Read them before you propose a structural change. Say so when one contradicts your task; do not work around it. An absent ADR does not mean the area is unconstrained: the set is still filling up, and the rules in this file stay binding. [`docs/adr/README.md`](docs/adr/README.md) defines when to write one and in what format. Follow it, not an ADR convention from a skill.

## Key Technical Details

### UI Component System

`@op/sense` (`packages/sense`) is the design system — shadcn/ui in its Base UI style, themed by `@op/styles`.

- **Read [`packages/sense/CLAUDE.md`](packages/sense/CLAUDE.md) before building UI.** It covers the accessibility obligations, how to add a primitive or composite, and the Base UI behaviours that bite.
- **Always prefer an existing `@op/sense` component over a vanilla html element** such as `<button>` or `<h2>`. Browse them with `pnpm w:sense dev` (Storybook, http://localhost:3600).
- **Import per component** — `import { Button } from '@op/sense/Button'` — and get `cn` from `@op/sense/lib/utils` (ours registers the custom type tokens with `tailwind-merge`; stock `twMerge` drops them).
- **Always use design tokens** — never arbitrary Tailwind values (e.g. `text-[14px]`, `bg-[#333]`):
  - Colors: semantic classes (e.g. `bg-primary`, `text-muted-foreground`, `border-input`) — raw values in `packages/styles/tokens.css`, semantic names in `packages/styles/theme.css`
  - Text sizes: the sense type scale (`text-label`, `text-title`, `text-headline`, `text-display`) — no raw Tailwind size utilities we haven't defined, and never the legacy `text-title-*` scale
- **Always use logical properties** — `ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`, `text-start`/`text-end` — never `ml-`/`pl-`/`left-`. The app ships Arabic.
- Tailwind configuration is centralized in `@op/styles`: `tokens.css` holds raw values, `theme.css` holds semantics and is the package entry

### Accessibility

Treat accessibility as a correctness property, not a polish pass. Base UI gives us focus management, keyboard navigation and `aria-*` wiring for free — don't reimplement or work around it. Four things it can't infer, which are on you:

1. **An accessible name on every icon-only control** (`aria-label` on `<Button size="icon-*">`) — the most common defect in this codebase
2. **A real label on every input** (`Field` + `FieldLabel`, or `htmlFor`) — a placeholder is not a label
3. **`aria-live="polite"` on content that changes without a navigation** — async results, counts, validation errors, save states
4. **Real controls for anything clickable** — never `onClick` on a `div`

Two harnesses check it, both punch-lists rather than allow-lists (CI fails on an unlisted violation *and* on a listed one that no longer fires):

- **Components**: the **A11y** panel in Storybook (`pnpm w:sense dev`) runs axe against the story you are looking at. Not yet CI-enforced — the headless gate is blocked upstream; see `packages/sense/README.md`
- **Routes**: `pnpm a11y:baseline` runs axe over every committed route — see `tests/e2e/a11y-baseline/README.md`

### Database & tRPC

- After schema changes: run `pnpm w:db generate` to generate migrations
- **NEVER RUN `pnpm w:db migrate`** (migrations are applied by CI/CD, not locally)
- **Drizzle relations**: define new relations in `services/db/relations.ts` using the v2 `defineRelations` API (the source of truth for `db.query`). The v1 `relations()` blocks in individual `*.sql.ts` files still exist for legacy `db._query` callers but should **not** be added for new tables.
- **Row types**: derive a table's row type with `typeof <table>.$inferSelect` (e.g. `export type Foo = typeof foos.$inferSelect;`). Prefer this over `InferModel<typeof <table>>`.

### Email recipients

**`auth.users.email` is the only delivery address.** No sender reads an email column directly — addresses come from the resolvers in `packages/common/src/services/email/recipients.ts`, keyed on `authUserId`. Every other `email` column is a snapshot with no working sync (`profile_users.email`, `public.users.email`) or an unverified public contact field (`profiles.email`, the org contact address).

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
- **Storybook**: `pnpm w:sense dev` serves the `@op/sense` design system on http://localhost:3600.
- **Never start or kill the dev server on :3100** — it is shared with other agents and managed externally; verify changes statically or in the browser against the already-running server
- Authorization checks are achieved by our access-zones library. We usually get the profileUser and pass the user's roles to `assertAccess`
