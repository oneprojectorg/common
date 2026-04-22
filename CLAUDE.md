# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and other AI agents when working with code in this repository.

## Development Commands

### Build and Quality Checks

- **Build all**: `pnpm build` (uses Turbo for optimized builds)
- **Type checking**: `pnpm typecheck` (runs type checking across all workspaces via Turbo) or `pnpm w:app typecheck` (for main app only)
- **Format checking**: `pnpm format:check` (verifies code formatting - required by CI)
- **Format changed files only**: `pnpm format:changes` (formats only files changed in git)
- **Tests**: `pnpm test` (runs integration tests)

## Architecture Overview

### Applications (`apps/`)

- **`apps/app`**: Main Next.js 15 frontend (App Router, React 19, Tailwind, Zustand)
- **`apps/api`**: tRPC API server with OpenAPI documentation

### Packages (`packages/`)

- **`@op/ui`**: Custom Intent UI / React Aria Components library using Tailwind variants and Storybook
- **`@op/core`**: Core utilities, configuration, and environment handling
- **`@op/hooks`**: Reusable React hooks (auth, data fetching)
- **`@op/common`**: Shared business logic and service layer

### Services (`services/`)

- **`@op/db`**: Drizzle ORM schema, migrations, and database client
- **`@op/api`**: tRPC routers, procedures, and middleware
- **`@op/supabase`**: Supabase client configuration (auth, storage)
- **`@op/emails`**: React Email templates with Tailwind styling
- **`@op/cache`**: Caching utilities and Redis integration

## Key Technical Details

### UI Component System

- UI components are in `@op/ui` and exported via `package.json` exports field
- **Always prefer using existing @op/ui components over vanilla html versions such as <button> or <h2>**
- **Always use design tokens** — never use arbitrary Tailwind values (e.g. `text-[14px]`, `bg-[#333]`)
- Import components like: `import { Button } from "@op/ui/Button"`
- Colors: use the token-mapped Tailwind classes (e.g. `text-primary-teal`, `bg-neutral-gray1`) — source tokens are in `packages/styles/tokens.css` (`--op-*`) mapped via `shared-styles.css`
- Text sizes: use the custom type scale (e.g. `text-title-lg`, `text-sm`) defined in `packages/styles/shared-styles.css` — do not use raw Tailwind size utilities that we have not defined a size for.
- Tailwind configuration is centralized in `@op/styles` package (`packages/styles/shared-styles.css`)

### Database & tRPC

- Database schema managed with Drizzle ORM in `services/db/schema/`
- tRPC API provides type-safe client-server communication
- After schema changes: run `pnpm w:db generate` to generate migrations 
- **NEVER RUN `pnpm w:db migrate`** (migrations are applied by CI/CD, not locally)

### Workspace Commands

Use `pnpm w:<workspace>` shortcuts:

- `pnpm w:app` - apps/app
- `pnpm w:api` - apps/api
- `pnpm w:db` - services/db
- `pnpm w:ui` - packages/ui
- `pnpm w:emails` - services/emails
- `pnpm w:supabase` - services/supabase
- `pnpm w:cache` - services/cache

### Dependency Management

- **Add dependencies**: `pnpm add <package> --filter <workspace-name>`
- **Clean unused deps**: `pnpm deps:clean`
- **Enforce version consistency**: `pnpm deps:override`


## AI Assistant Guidelines

### Branch Management
- **NEVER commit or push** - these actions are always manual

### File Search Scope

- **NEVER search outside the current worktree. Do not exit the current working directory.**
- The working directory is the root of the monorepo; do not traverse to parent directories or other projects

### Code Quality Standards

- Run type checking with `pnpm typecheck` after making changes
- Follow existing code conventions and patterns in the file being edited
- Using `any` to fix type errors should always be avoided
- Avoide type assertions (`as` keyword)
- Code quality is enforced via **oxfmt** (pnpm format) and **TypeScript** (type checking) only

### Coding Conventions

- If statements should never be all on one line; always use K&R style for if statements
- Always prefer suspense queries over a query with useEffect
- When using Suspense Queries, always add proper error boundaries
- **Component file structure**: Types and interfaces at the top, then the main exported component, then private sub-components and helper functions below. The primary export should be easy to find near the top of the file — don't bury it under utilities.

### Internationalization (i18n)

- **Translation files location**: `apps/app/src/lib/i18n/dictionaries/`
- **Supported languages**: All `.json` files in the dictionaries folder (e.g., `en.json`, `es.json`, `pt.json`, etc.)
- **Use `useTranslations` hook for client components**: `const t = useTranslations()` then `t('Key string')`
- **Use `TranslatedText` component** for server components

**CRITICAL: When adding or modifying user-facing strings:**

1. **ALWAYS** wrap strings with `t('...')` - never hardcode user-facing text
4. **For dynamic values**, use interpolation: `t('Hello {name}', { name: userName })` and `t.rich()` for strings that are broken up with styles/components.

## Workflow Notes

- If you need to check interactions in the browser, you can use the Playwright MCP server and open http://localhost:3100 to open the dev server
- Authorization checks are achieved by our access-zones library. We usually get the profileUser and pass the user's roles to `assertAccess`
