# Contributing to OneProject

Thank you for your interest in contributing to OneProject! This guide will help you get started with contributing to our monorepo.

## Getting Started

### Prerequisites

- Node.js 18+ (use `corepack enable` for pnpm version management)
- Git

### Setting Up the Development Environment

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Build all packages: `pnpm build`

## Development Workflow

### Branch Strategy

We use a feature branch workflow based on the `dev` branch:

- **Bug fixes**: `bug/descriptive-name` (e.g., `bug/fix-login-validation`)
- **Features**: `feature/descriptive-name` (e.g., `feature/user-dashboard`)

### Making Changes

1. **Check current branch**: `git branch`
2. **Create a new branch** from `dev`:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** following the architecture patterns
4. **Test your changes** thoroughly
5. **Run quality checks**:
   ```bash
   pnpm w:app lint    # Type checking
   pnpm format        # Code formatting
   ```
6. **Commit your changes** with descriptive messages
7. **Push and create a pull request**

### Commit Guidelines

- Use descriptive commit messages that explain the "why" not just the "what"
- Keep commits focused and atomic
- Follow conventional commit format when possible

## Architecture Overview

This is a **Turborepo monorepo** using **pnpm workspaces**:

### Applications (`apps/`)
- **`apps/app`**: Main Next.js 15 frontend
- **`apps/api`**: tRPC API server

### Packages (`packages/`)
- **`@op/ui`**: React Aria Components library
- **`@op/core`**: Core utilities and configuration
- **`@op/hooks`**: Reusable React hooks
- **`@op/common`**: Shared business logic

### Services (`services/`)
- **`@op/db`**: Drizzle ORM schema and migrations
- **`@op/api`**: tRPC routers and procedures
- **`@op/supabase`**: Supabase client configuration
- **`@op/emails`**: React Email templates
- **`@op/cache`**: Caching utilities

## Code Style and Standards

### General Guidelines

- Follow existing code conventions in the file you're editing
- Use TypeScript strictly (no `any` types)
- Write self-documenting code with clear variable names
- Only use colors present in the tailwind.shared config

### UI Components

- Use React Aria Components for accessibility
- Import components like: `import { Button } from "@op/ui/Button"`
- Follow the component patterns in `@op/ui`

### Database Changes

After making schema changes:
1. Run `pnpm w:db generate`
2. Run `pnpm w:db migrate`

## Testing

- Test your changes thoroughly before submitting
- Follow existing testing patterns in the codebase
- Ensure all existing tests pass

## Workspace Commands

Use these shortcuts for common operations:

```bash
pnpm w:app      # Work with apps/app
pnpm w:api      # Work with apps/api
pnpm w:db       # Work with services/db
pnpm w:ui       # Work with packages/ui
pnpm w:emails   # Work with services/emails
```

## Dependency Management

- **Add dependencies**: `pnpm add <package> --filter <workspace-name>`
- **Clean unused deps**: `pnpm deps:clean`
- **Enforce version consistency**: `pnpm deps:override`

## Pull Request Process

1. Ensure your branch is up to date with `dev`
2. Run all quality checks locally
3. Create a pull request with a clear description
4. Link any related issues
5. Wait for review and address feedback

## Getting Help

- Check existing issues for similar problems
- Review the codebase for examples
- Ask questions in pull request discussions

## Code of Conduct

Please be respectful and constructive in all interactions. We're building something great together!