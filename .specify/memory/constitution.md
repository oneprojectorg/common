<!--
Sync Impact Report:
- Version change: 1.0.0 → 1.1.0 (Added explicit branch checkout principle)
- Modified principles: Development Workflow - Enhanced branch management rules
- Added sections: Explicit branch checkout restrictions
- Removed sections: None
- Templates requiring updates:
  ✅ .specify/templates/plan-template.md - Compatible with branch guidelines
  ✅ .specify/templates/spec-template.md - No branch management references
  ✅ .specify/templates/tasks-template.md - No branch management references
- Scripts requiring updates:
  ✅ .specify/scripts/bash/create-new-feature.sh - Removed automated git checkout
- Follow-up TODOs: None
-->

# OP Monorepo Constitution

## Core Principles

### I. Monorepo Architecture
Each workspace MUST maintain clear separation of concerns within the Turborepo structure. Applications (`apps/`), packages (`packages/`), and services (`services/`) MUST have well-defined boundaries and responsibilities. Dependencies between workspaces MUST be declared explicitly through package.json and imports MUST follow established patterns (`import { Button } from "@op/ui/Button"`).

**Rationale**: Maintains modularity and prevents circular dependencies while enabling efficient builds through Turbo's dependency graph optimization.

### II. Type Safety First
All code MUST maintain end-to-end type safety through TypeScript and tRPC. Using `any` to fix type errors MUST be avoided. Database schema changes MUST be followed by `pnpm w:db generate` then `pnpm w:db migrate`. Every workspace MUST extend appropriate base TypeScript configs from `configs/typescript-config/`.

**Rationale**: Type safety prevents runtime errors, improves developer experience, and ensures API contract compliance between frontend and backend.

### III. Test-Driven Development
Tests MUST be written before implementation. Suspense queries are preferred over useEffect patterns, and proper error boundaries MUST accompany Suspense usage. Contract tests, integration tests, and unit tests MUST follow the established patterns and file structure conventions.

**Rationale**: TDD ensures requirements are met, reduces bugs, and provides living documentation of expected behavior.

### IV. Quality Gates
Every change MUST pass type checking with `pnpm w:app lint` before completion. Database migrations MUST never be run manually. Code formatting with `pnpm format` MUST only be run when explicitly requested. K&R style MUST be used for if statements (no single-line conditionals).

**Rationale**: Consistent quality gates prevent broken builds and maintain code consistency across the monorepo.

### V. Component System Standards
UI components MUST use React Aria for accessibility, follow Tailwind variants patterns, and be properly exported through package.json exports field. Only colors present in tailwind.shared config MUST be used. Components MUST be reusable and documented through Storybook.

**Rationale**: Ensures accessibility compliance, design system consistency, and component reusability across applications.

## Development Workflow

Branch management MUST follow established conventions: checkout new branches when on `dev`, use `bug/descriptive-name` or `feature/descriptive-name` naming. **Feature branch checkout MUST never be automated by development tools as this is handled separately by external processes.** Manual operations (commit, push, pull) MUST never be automated. Authorization checks MUST use the access-zones library with `assertAccess` pattern.

Parameter types MUST be defined inline within function signatures unless interfaces are shared across multiple functions. Dependency management MUST use workspace-specific commands (`pnpm add <package> --filter <workspace-name>`).

## Code Quality Standards

Node.js 18+ is required with `corepack enable` for pnpm version management. All workspaces MUST use workspace shortcuts (`pnpm w:app`, `pnpm w:api`, etc.). The Playwright MCP server MUST be used for browser testing at http://localhost:3100.

Database connections and API calls MUST be managed through established service layers. Shared configurations MUST be centralized in appropriate packages (`@op/core`, `@op/ui`).

## Governance

This constitution supersedes all other development practices and guidelines. All code changes MUST comply with these principles before merge approval. Constitution violations MUST be documented and justified in complexity tracking sections of implementation plans.

Amendments require documentation of version changes, impact analysis, and migration plans. The constitution version MUST follow semantic versioning: MAJOR for backward-incompatible governance changes, MINOR for new principles or expanded guidance, PATCH for clarifications and refinements.

All implementation plans MUST include Constitution Check sections that verify compliance before Phase 0 research and after Phase 1 design. Development workflow violations MUST be blocked until compliance is achieved or justified.

**Version**: 1.1.0 | **Ratified**: 2025-09-22 | **Last Amended**: 2025-09-22