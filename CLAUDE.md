# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development Workflow

### Build and Quality Checks

- **Build all**: `pnpm build` (uses Turbo for optimized builds)
- **Type checking**: `pnpm w:app lint` (for main app typechecking as well as API checking)
- Never run database migrations
- NEVER run `pnpm format`

## Architecture Overview

This is a **Turborepo monorepo** using **pnpm workspaces** with a clear separation of concerns:

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

### Database & tRPC

- Database schema managed with Drizzle ORM in `services/db/schema/`
- tRPC API provides type-safe client-server communication
- After schema changes: run `pnpm w:db generate` then `pnpm w:db migrate`

### Workspace Commands

Use `pnpm w:<workspace>` shortcuts:

- `pnpm w:app` - apps/app
- `pnpm w:api` - apps/api
- `pnpm w:db` - services/db
- `pnpm w:ui` - packages/ui
- `pnpm w:emails` - services/emails
- `pnpm w:supabase` - services/supabase

### Dependency Management

- **Add dependencies**: `pnpm add <package> --filter <workspace-name>`
- **Clean unused deps**: `pnpm deps:clean`
- **Enforce version consistency**: `pnpm deps:override`

### TypeScript Configuration

- Shared configs in `configs/typescript-config/`
- Each workspace extends appropriate base config (nextjs.json, react-library.json, etc.)

## AI Assistant Guidelines

### Branch Management

- **ALWAYS** checkout a new branch when making changes if currently on the `dev` branch
- **Branch naming convention**:
  - Bug fixes: `bug/descriptive-name` (e.g., `bug/fix-login-validation`)
  - Features: `feature/descriptive-name` (e.g., `feature/user-dashboard`)
- **NEVER commit, push, or pull** - these actions are always manual

### Code Quality Standards

- Run type checking with `pnpm w:app lint` after making changes
- Format code with `pnpm format` after making changes
- Follow existing code conventions and patterns in the file being edited
- Test changes thoroughly before completion
- Using `any` to fix type errors shuold be avoided

### Coding Conventions

- If statements should never be all on one line, rather you should always use K&R style for if statements

## Important Notes

- Node.js 18+ required, use `corepack enable` for pnpm version management
- UI components use React Aria for accessibility
- tRPC provides end-to-end type safety between frontend and backend
- Tailwind configuration is centralized in `@op/ui` package
- Only use colors that are present in the tailwind.shared config

## Workflow Warnings

- Don't run pnpm format unless specifically asked to do so
