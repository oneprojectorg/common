# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and other AI agents when working with code in this repository.

## Development Commands

### Build and Quality Checks

- **Build all**: `pnpm build` (uses Turbo for optimized builds)
- **Type checking**: `pnpm typecheck` (runs type checking across all workspaces via Turbo) or `pnpm w:app typecheck` (for main app only)
- **Format checking**: `pnpm format:check` (verifies code formatting - required by CI)
- **Format changed files only**: `pnpm format:changes` (formats only files changed in git)
- NEVER run `pnpm format` (auto-fix on all files) - use `pnpm format:check` to verify or `pnpm format:changes` for targeted fixes

## Architecture Overview

### Applications (`apps/`)

- **`apps/app`**: Main Next.js 15 frontend (App Router, React 19, Tailwind, Zustand)
- **`apps/api`**: tRPC API server with OpenAPI documentation

### Packages (`packages/`)

- **`@op/ui`**: React Aria Components library with Tailwind variants and Storybook
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
- Components use React Aria Components with Tailwind variants
- Import components like: `import { Button } from "@op/ui/Button"`
- **Always use design tokens** — never use arbitrary Tailwind values (e.g. `text-[14px]`, `bg-[#333]`)
- Colors: use the token-mapped Tailwind classes (e.g. `text-primary-teal`, `bg-neutral-gray1`) — source tokens are in `packages/styles/tokens.css` (`--op-*`) mapped via `shared-styles.css`
- Text sizes: use the custom type scale (e.g. `text-title-lg`, `text-body-sm`) defined in `packages/styles/shared-styles.css` — do not use raw Tailwind size utilities like `text-sm` or `text-xl`
- Tailwind configuration is centralized in `@op/styles` package (`packages/styles/shared-styles.css`)

### Intent UI Components

Intent UI is a shadcn-compatible component library built on React Aria. To add a component:

1. **Browse components** at https://intentui.com/docs/components
2. **Fetch the component JSON** from `https://intentui.com/r/{component-name}.json` (e.g., `https://intentui.com/r/table.json`)
3. **Copy the component code** to `packages/ui/src/components/ui/{component}.tsx`
4. **Update imports** to use local paths:
   - `@/lib/primitive` → `@/lib/primitive` (already exists)
   - `@/hooks/use-media-query` → `@/hooks/use-media-query` (already exists)
   - Replace any icon imports with `react-icons/lu` (e.g., `import { LuChevronDown } from 'react-icons/lu'`)
5. **Add export** to `packages/ui/package.json` exports field
6. **Create Storybook story** in `packages/ui/stories/`
7. **Run `pnpm w:ui typecheck`** to verify

**Key files:**
- `packages/styles/intent-ui-theme.css` - Theme mapping to OP brand tokens
- `packages/ui/src/lib/primitive.ts` - `cx()` utility for React Aria render props
- `packages/ui/src/hooks/use-media-query.ts` - Media query hook

### Database & tRPC

- Database schema managed with Drizzle ORM in `services/db/schema/`
- tRPC API provides type-safe client-server communication
- After schema changes: run `pnpm w:db generate` to generate migrations — **never run `pnpm w:db migrate`** (migrations are applied by CI/CD, not locally)

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

- **ALWAYS** checkout a new branch when making changes if currently on the `main` branch
- **Branch naming convention**:
  - Bug fixes: `fix-login-validation`
  - Features: `user-dashboard`
  - **Do not** prefix your branch with your name or initials
- **NEVER commit, push, or pull** - these actions are always manual

### File Search Scope

- **NEVER search outside the current worktree** - all searches should stay within the current working directory
- The working directory is the root of the monorepo; do not traverse to parent directories or other projects

### Code Quality Standards

- Run type checking with `pnpm typecheck` or `pnpm w:app typecheck` after making changes
- Follow existing code conventions and patterns in the file being edited
- Using `any` to fix type errors should be avoided
- Code quality is enforced via **Prettier** (formatting) and **TypeScript** (type checking) only

### Coding Conventions

- If statements should never be all on one line; always use K&R style for if statements
- Always prefer defining parameter types directly inline within the function signature over separate interface definitions, unless the interface is used across multiple functions
- Almost always prefer suspense queries over a query with useEffect
- When using Suspense Queries, always add proper error boundaries

### Internationalization (i18n)

- **Translation files location**: `apps/app/src/lib/i18n/dictionaries/`
- **Supported languages**: All `.json` files in the dictionaries folder (e.g., `en.json`, `es.json`, `pt.json`, etc.)
- **Use `useTranslations` hook**: `const t = useTranslations()` then `t('Key string')`
- **Use `TranslatedText` component** for server components

**CRITICAL: When adding or modifying user-facing strings:**

1. **ALWAYS** wrap strings with `t('...')` - never hardcode user-facing text
2. **ALWAYS** add the translation key to ALL language files in the dictionaries folder, not just `en.json`
3. **BEFORE completing any task** that touches UI text, verify the translation key exists in every language file
4. **For dynamic values**, use interpolation: `t('Hello {name}', { name: userName })`
5. **When modifying existing translation keys**, update ALL language files

## Workflow Notes

- If you need to check interactions in the browser, you can use the Playwright MCP server and open http://localhost:3100 to open the dev server
- Authorization checks are achieved by our access-zones library. We usually get the orgUser and pass the user's roles to `assertAccess`
