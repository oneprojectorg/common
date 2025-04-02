# `@op/ui` Workspace

This workspace contains the core UI components for the application, built using React, [React Aria Components](https://react-spectrum.adobe.com/react-aria/react-aria-components.html), and styled with [Tailwind CSS](https://tailwindcss.com/) and [tailwind-variants](https://www.tailwind-variants.org/). [Storybook](https://storybook.js.org/) is used for component development, testing, and documentation.

## Purpose

The main goal of this package is to provide a consistent, accessible, and reusable set of UI components that can be used across different parts of the application, primarily the main web application (`apps/app`).

## Structure

- **`src/components/`**: Contains the individual React components (e.g., `Button.tsx`, `Dialog.tsx`, `TextField.tsx`). Each component is typically exported directly.
- **`src/lib/`**: Contains utility functions, specifically `src/lib/utils.ts` which exports `cn` (clsx + tailwind-merge) and re-exports `tailwind-variants` for styling utilities.
- **`src/*.ts`**: Files like `RAC.ts`, `RAH.ts`, `RAS.ts` re-export symbols from `react-aria-components`, `react-aria`, and `react-stately` respectively. `useGesture.ts` re-exports the `useGesture` hook from `@use-gesture/react`.
- **`tailwind.shared.ts`**: Shared Tailwind configuration presets or plugins used internally by this package (e.g., for Storybook), and consumed by other workspaces.
- **`tailwind.styles.scss`**: Base styles or global CSS definitions related to Tailwind.
- **`tailwind.utils.mjs`**: Tailwind utility functions or helpers.
- **`storybook/`**: Configuration and stories for Storybook.

Components and utilities are exported via the `exports` map in `package.json`.

## Key Technologies

- **React**: UI library.
- **React Aria Components**: Library for building accessible UI components.
- **Tailwind CSS**: Utility-first CSS framework.
- **tailwind-variants**: Library for creating type-safe component variants with Tailwind.
- **Storybook**: UI component development environment.
- **Lucide Icons**: Icon library.
- **Clsx / tailwind-merge**: Utilities for managing CSS classes.

## Relationship to Other Workspaces

**Depends On:**

- **`@op/core`**: For shared constants, specifically `commonColors` used in `tailwind.shared.ts`.
- **`@op/eslint-config` (Dev)**: Used for linting configuration during development.
- **`@op/typescript-config` (Dev)**: Used for TypeScript configuration during development.

**Depended On By:**

- **`apps/api`**: Listed as a dependency, but doesn't appear to actively import or use components from this package.
- **`apps/app`**: The primary consumer of the UI components defined here.

## Development

- Run `pnpm dev` to start the Storybook server (usually on port 3600).
- Run `pnpm lint` to lint and type-check the code.
- Run `pnpm build` to create a production build of Storybook.
