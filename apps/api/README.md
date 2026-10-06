# `api` Workspace (apps/api)

This workspace is a TanStack Start application (Vite + Nitro) that serves only server routes: it hosts the tRPC API and the webhook endpoints. It renders no pages.

## Purpose

- **Host tRPC API**: Exposes the tRPC router defined in `@op/api` as an HTTP endpoint (`src/routes/api/v1/trpc/$trpc.ts`) that the frontend application (`apps/app`) consumes.

## Structure

- **`src/routes/api/v1/trpc/$trpc.ts`**: The tRPC endpoint, served through `@trpc/server/adapters/fetch`, with its CSRF gate and CORS headers.
- **`src/routes/api/v1/workflows.ts`**: The Inngest endpoint for `@op/workflows`.
- **`src/routes/api/v1/moderation/webhooks.ts`**, **`src/routes/api/v1/notifications/twilio/status.ts`**: Provider webhooks.
- **`src/routes/index.ts`**: `/` redirects to the main application; **`src/routes/$.ts`** answers every other path with a 404.
- **`src/start.ts`**: Request middleware — request logging and CORS for every `/api` request (preflights are answered there), and the `x-forwarded-for` fallback for local servers.
- **`src/server/plugins/observability.ts`**: Nitro plugin that registers OpenTelemetry at startup and reports captured server errors.
- **`vite.config.ts`**: Vite, TanStack Start and Nitro configuration, including the e2e module mocks and the Vercel function settings.

## Key Technologies

- **TanStack Start**: Server routes and request middleware.
- **Nitro**: Server build; deploys to Vercel through its `vercel` preset.
- **tRPC**: Consumes the router from `@op/api` through the fetch adapter.
- **`@op/api`**: Provides the actual API logic and router definition, consumed by the tRPC route.
- **`@op/supabase`**: Used for server-side Supabase client creation, utilized within the tRPC context.
- **dotenv**: Loads environment variables at build and dev time.

## Relationship to Other Workspaces

**Depends On:**

- **`@op/core`**: For shared configurations or utilities.
- **`@op/supabase`**: For server-side Supabase client utilities used in tRPC context/routes.
- **`@op/api`**: Consumes the tRPC router definition (`appRouter`) and context creation (`createContext`).
- **`@op/workflows`**: The Inngest functions served at `/api/v1/workflows`.
- **`@op/typescript-config` (Dev)**: For TypeScript configuration.

**Depended On By:**

- (Provides the API endpoint consumed by `apps/app` at runtime, but not a build dependency).

## Development

- Run `pnpm dev` to start the Vite development server on port 3300.
- Run `pnpm typecheck` to type-check the code.
- Run `pnpm build` to create a production build in `.output/`.
- Run `pnpm start` to run the production build.
- Run `pnpm routes:generate` after adding, moving or renaming a route file, to regenerate `src/routeTree.gen.ts`.
