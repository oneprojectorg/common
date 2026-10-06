# `app` Workspace (apps/app)

This workspace contains the main frontend web application, built with [TanStack Start](https://tanstack.com/start) (TanStack Router on Vite, served by Nitro).

## Purpose

This is the user-facing application. It integrates various shared packages and services from the monorepo to provide the application's features and user interface.

## Structure

- **`src/routes/`**: File-based routes — pages, layouts (`route.tsx`) and server routes (`server.handlers`, e.g. `src/routes/api/…`). `$locale` is the locale segment; `_main` (walled garden) and `_noHeader` (public) are pathless layout groups.
- **`src/routeTree.gen.ts`**: The generated route tree. Committed; `vite dev` and `vite build` regenerate it, and `pnpm routes:generate` does so without a build.
- **`src/router.tsx`**: Router setup — search-param parsing, default error/not-found screens, the vanity decision URL rewrite, and the per-request CSP nonce.
- **`src/start.ts`**: Global request middleware — security headers, Content-Security-Policy, CSRF for server functions, and the 403 status for forbidden pages.
- **`src/proxy.ts`**: Supabase session refresh and the redirect that adds a locale to locale-less paths, run from `src/start.ts`.
- **`src/server/`** and **`*.functions.ts`**: Server functions (`createServerFn`) that route loaders call for server-side data; `src/server/plugins/` holds Nitro runtime plugins (observability).
- **`src/components/`**: Components specific to this application (complementing `@op/sense`).
- **`src/lib/`**: App libraries — `i18n` (use-intl provider, `Link`, locale-aware navigation, `getTranslations`), `navigation` (router helpers), `head` (page titles), `csp.mjs`.
- **`src/hooks/`**, **`src/utils/`**: Hooks and utilities specific to this application.
- **`public/`**: Static assets.
- **`vite.config.ts`**: Vite, TanStack Start and Nitro configuration — public env inlining, route rules (asset/PostHog proxies, cache headers), PostHog sourcemap upload.
- **`postcss.config.mjs`**: PostCSS and Tailwind CSS.

## Key Technologies

- **TanStack Start / TanStack Router**: Routing, SSR, server functions and middleware.
- **Vite** and **Nitro**: Build and server runtime (Nitro's `vercel` preset on Vercel, its node-server preset locally).
- **React**, **TypeScript**.
- **use-intl**: Translations, wrapped by `@/lib/i18n`.
- **`@op/sense`**: Consumes the shared design system.
- **`@op/hooks`**: Uses shared React hooks for logic and data fetching.
- **`@op/api`**: The tRPC client (`TRPCProvider.tsx`) for the API hosted by `apps/api`, and the in-process server caller used by server functions.
- **`@op/supabase`**: Supabase clients for authentication.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **Zustand**: Client-side state management library.
- **@op/sense Toast**: Toast/notification primitive (built on Base UI).

## Relationship to Other Workspaces

**Depends On:**

- **`@op/core`**: For shared configuration or types.
- **`@op/hooks`**: Utilizes shared hooks.
- **`@op/supabase`**: Uses Supabase client utilities.
- **`@op/api`**: Imports the tRPC provider/client and server caller.
- **`@op/typescript-config` (Dev)**: For TypeScript configuration.
- **`@op/sense`**: Renders UI components provided by this package.
- **`@op/styles`**: For tailwindcss config and base styles.

**Depended On By:**

- _(None - this is a final application)_

## Development

- Run `pnpm dev` to start the Vite development server (on port 3100).
- Run `pnpm typecheck` to type-check the code.
- Run `pnpm build` to create a production build in `.output/`.
- Run `pnpm start` to run the production build (on port 3100).
- Run `pnpm routes:generate` after adding, moving or renaming a route file outside a running dev server.
- Set `ANALYZE=true` on a build to write `bundle-analysis.html`.

## Deploy on Vercel

Nitro detects Vercel during the build and writes the Build Output API format (`.vercel/output`), so the Vercel project builds with `vite build` and needs no framework preset of its own.
