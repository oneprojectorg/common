# `api` Workspace (apps/api)

This workspace is a Next.js application that primarily serves as the host for the tRPC API endpoint and potentially provides API documentation.

## Purpose

- **Host tRPC API**: Exposes the tRPC router defined in `@op/trpc` as an HTTP endpoint (`app/api/v1/trpc/[trpc]/route.ts`) that the frontend application (`apps/app`) can consume.
- **API Documentation**: Generates an OpenAPI specification using `trpc-to-openapi` accessible at `app/api/v1/openapi.json/route.ts` and serves an interactive API reference UI using `@scalar/nextjs-api-reference` at the root (`app/route.tsx`).

## Structure

As a Next.js application using the App Router, the structure includes:

- **`app/api/v1/trpc/[trpc]/route.ts`**: The main Next.js API route handler that uses `@trpc/server/adapters/fetch` to serve the tRPC router from `@op/trpc`.
- **`app/api/v1/openapi.json/route.ts`**: Endpoint serving the generated OpenAPI specification via `trpc-to-openapi`.
- **`app/api/v1/[...trpc]/route.ts`**: An additional admin-protected route using `createOpenApiFetchHandler` from `trpc-to-openapi`.
- **`app/route.tsx`**: The root route serving the API reference UI using `@scalar/nextjs-api-reference`.
- **`next.config.mjs`**: Next.js configuration file.
- **`postcss.config.js`, `tailwind.config.js`**: Configuration for PostCSS and Tailwind CSS, although UI might be minimal if it mainly serves the API.

## Key Technologies

- **Next.js**: React framework used to build the API server.
- **tRPC**: Consumes the router from `@op/trpc` and uses the Next.js adapter to handle requests.
- **`@op/trpc`**: Provides the actual API logic and router definition, consumed by the tRPC route handlers.
- **`@op/supabase`**: Used for server-side Supabase client creation, utilized within the tRPC context and potentially the OpenAPI handlers.
- **`@scalar/nextjs-api-reference`**: Library for embedding an interactive API reference documentation UI within a Next.js application.
- **`trpc-to-openapi`**: Utility used to generate the OpenAPI specification served at `app/api/v1/openapi.json/route.ts`.
- **dotenv**: Loads environment variables.

## Relationship to Other Workspaces

**Depends On:**

- **`@op/core`**: For shared configurations or utilities.
- **`@op/eslint-config` (Dev)**: For linting configuration.
- **`@op/supabase`**: For server-side Supabase client utilities used in tRPC context/routes.
- **`@op/trpc`**: Consumes the tRPC router definition (`appRouter`) and context creation (`createContext`).
- **`@op/typescript-config` (Dev)**: For TypeScript configuration.
- **`@op/ui`**: UI components are used for the API documentation page (`app/route.tsx`).

**Depended On By:**

- (Provides the API endpoint consumed by `apps/app` at runtime, but not a build dependency).

## Development

- Run `pnpm dev` to start the Next.js development server (usually on port 3300).
- Run `pnpm lint` to lint and type-check the code.
- Run `pnpm build` to create a production build.
- Run `pnpm start` to run the production build.
