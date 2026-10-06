# NNNN. Serve both apps with TanStack Start on Vercel

Date: 2026-10-06

## Status

Proposed

## Context

`apps/app` and `apps/api` ran on Next.js App Router. The app is almost
entirely client components fed by tRPC, so React Server Components bought
little and cost a lot: a server/client split to reason about on every file,
Turbopack/webpack divergence (the production build had to fall back to
webpack after "Could not find module ... in the React Client Manifest" 500s),
and framework-owned routing, middleware and i18n (`next-intl`) that the rest of
the monorepo couldn't share.

In scope: the framework, router, server entry, middleware, i18n runtime and
hosting of both apps. Out of scope: tRPC, React Query, the service layer and
the database.

## Decision

We will build both apps with TanStack Start (Vite + Nitro) and deploy them to
Vercel through Nitro's `vercel` preset.

- Routes are files in `src/routes` (`$locale/_main`, `$locale/_noHeader` replace
  the `(main)` / `(no-header)` groups). Server data comes from loaders calling
  `createServerFn` server functions in `*.functions.ts` files; no component
  runs only on the server.
- The request middleware in `apps/app/src/start.ts` does what `proxy.ts` and
  `next.config.mjs` headers did: session refresh, locale redirect, per-request
  CSP nonce, security headers, and a 403 status for `forbidden()`.
- i18n runs on `use-intl` (the library `next-intl` is built on) behind
  `@/lib/i18n`; `getTranslations` takes the locale explicitly.
- Rewrites to PostHog and S3 are Nitro `routeRules` proxies, which Vercel serves
  as CDN rewrites.

## Consequences

Easier: one execution model (every component renders on the server and the
client), typed routes and params, Vite in dev and production alike, and
middleware written against the standard `Request`/`Response`.

Harder: server-only code must stay inside server-function handlers or files
marked `@tanstack/react-start/server-only`, or it reaches the browser bundle.
The router reports only 200/404/500, so other statuses (403) are set in
middleware. Next's per-segment streaming (`loading.tsx`) becomes route
`pendingComponent`s, and the router does not stream a page before its loaders
finish. The Vercel projects' framework preset must be changed from Next.js.
