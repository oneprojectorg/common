<!--
Sync Impact Report:
- Version change: 1.3.0 → 1.4.0 (new principle added)
- Modified principles: N/A
- Added sections: X. API Middleware Requirements (new principle)
- Removed sections: N/A
- Templates requiring updates:
  * .specify/templates/tasks-template.md ✅ validated for consistency
  * .specify/templates/plan-template.md ✅ validated for consistency
  * .specify/templates/spec-template.md ✅ validated for consistency
  * .specify/templates/agent-file-template.md ✅ validated for consistency
- Follow-up TODOs: None - no additional template updates required
-->

# Constitution of the Common Monorepo Project

**Version:** 1.4.0
**Effective Date:** 2025-09-26
**Last Amended:** 2025-09-26

# Common Monorepo Constitution

## Core Principles

### I. Agent Compliance
All development work MUST follow the rules and guidelines specified in AGENTS.md. This file serves as the authoritative source for development standards, workflow requirements, and technical constraints. No exceptions are permitted without explicit documentation and justification.

### II. Database Protection
Database commands MUST NEVER be executed during development workflows. This includes but is not limited to migrations, schema changes, direct database queries, or any operations that modify database state. Database operations are restricted to designated database administrators and controlled deployment processes only.

### III. UI Component Consistency
All user interface components MUST use the @op/ui library whenever possible. Custom components are only permitted when equivalent functionality does not exist in @op/ui. When creating new UI elements, developers MUST first search for existing components in the library and follow established patterns for component usage and integration.

### IV. Color System Compliance
All color definitions MUST use colors that are present in the tailwind.shared.ts configuration file. Developers are prohibited from inventing or defining new colors outside of this system. The shared color palette ensures visual consistency across the entire monorepo and MUST be respected in all styling decisions.

### V. Code Clarity
Code MUST NOT include comments unless explicitly requested. Code should be self-documenting through clear naming conventions, proper structure, and idiomatic patterns. The focus is on writing clean, readable code that communicates intent through implementation rather than documentation.

### VI. API Security
API endpoints MUST NEVER be created without implementing assertAccess authorization checks. Every endpoint MUST determine and verify WHO can access the data being exposed. Authorization checks are non-negotiable security requirements that protect sensitive data and enforce proper access controls.

### VII. Workflow Boundaries
Automated development workflows MUST NEVER create new branches or submit pull requests. Branch creation, checkout operations, and PR submission are exclusively manual operations controlled by human developers. This ensures proper workflow control and prevents automated systems from interfering with established branching strategies and review processes.

### VIII. Implementation Validation
All implementations MUST be validated by running `pnpm w:app lint` at the end of every development session to ensure code compiles correctly and passes type checking. This command MUST be executed before considering any implementation complete. Type errors, compilation failures, or linting violations MUST be resolved before moving to the next phase of development or marking tasks as completed.

### IX. Database Access Patterns
Database calls MUST NEVER be made directly within API routers. All database operations MUST be abstracted into service functions located in the packages/common package. Routers are responsible only for request/response handling and input validation - all business logic and data access MUST be delegated to appropriately scoped service functions. This separation ensures proper layering, testability, and reusability of database operations across the application.

### X. API Middleware Requirements
All router endpoints MUST implement exactly three middleware components in the following mandatory order: `withRateLimited({ windowSize: 10, maxRequests: 5 })`, `withAuthenticated`, and `withAnalytics`. This standardized middleware stack ensures consistent rate limiting, authentication, and analytics across all API endpoints. No endpoint may omit any of these middleware components, and the order MUST NOT be altered. This principle ensures uniform security, observability, and performance characteristics across the entire API surface.

## Development Standards

Development practices MUST align with existing codebase conventions. Developers MUST search for similar usage patterns of components and follow established coding styles. The monorepo structure using Turborepo and pnpm workspaces defines clear boundaries between applications, packages, and services that MUST be respected.

Type safety is paramount - using `any` to fix type errors should be avoided. The tRPC system provides end-to-end type safety between frontend and backend that MUST be maintained. All development workflows MUST include proper type checking and validation to ensure system reliability.

## Security Requirements

Authorization is achieved through the access-zones library. Developers MUST obtain the orgUser and pass the user's roles to assertAccess for all protected resources. Security by design is required - security considerations cannot be retrofitted after implementation.

All API endpoints MUST implement proper authorization before exposing any data or functionality. This principle is absolute and admits no exceptions regardless of development timeline or perceived urgency.

## Governance

This constitution supersedes all other development practices and guidelines. All code reviews, pull requests, and development decisions MUST verify compliance with these principles.

Amendments to this constitution require documentation of the change rationale, impact assessment, and migration plan for existing code that may be affected.

Complexity that violates these principles MUST be justified with specific technical reasoning and documentation of simpler alternatives that were considered and rejected.

**Version**: 1.4.0 | **Ratified**: 2025-09-25 | **Last Amended**: 2025-09-26