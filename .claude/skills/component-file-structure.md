---
name: component-file-structure
description: Conventions for organizing a React component file in this repo. Use when creating or refactoring a component.
---

## Order inside a file

1. **Types and interfaces** at the top.
2. **Main exported component** next — it's the headline, easy to find.
3. **Private sub-components and helpers** below.

The primary export should never be buried at the bottom under utilities.

## Type discipline

- No `any` to suppress errors. Find the right type.
- Avoid `as` (type assertions). Use type guards or refine inputs instead.
- Prefer `unknown` + narrowing over `any`.

## Data fetching

- **Always prefer Suspense queries** over `useQuery` + `useEffect` patterns.
- Wrap suspense queries with a proper `<ErrorBoundary>` — never let a thrown promise escape into a parent that doesn't handle it.

## Performance

When writing or refactoring components, follow the `vercel-react-best-practices` skill (in `.claude/skills/vercel-react-best-practices/`). It's the source of truth for waterfall avoidance, bundle size, server/client data fetching, re-render and rendering performance. Cross-reference its rules (e.g. `async-parallel`, `bundle-barrel-imports`, `rerender-derived-state-no-effect`) before reaching for `useEffect`, before adding a barrel import, and before chaining `await`s.

## If statements

- K&R braces, never single-line: write `if (x) { foo(); }` (or with newlines), never `if (x) foo();`.

## Verify

After edits to a component, run `pnpm w:app typecheck` to catch regressions.
