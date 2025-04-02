# `app` Workspace (apps/app)

This workspace contains the main frontend web application, built using the [Next.js](https://nextjs.org/) framework.

## Purpose

This is the user-facing application. It integrates various shared packages and services from the monorepo to provide the application's features and user interface.

## Structure

As a Next.js application using the App Router, it follows standard conventions:

- **`app/`**: Contains the application routes, pages, layouts, and components.
  - Utilizes Server Components and Client Components.
- **`app/api/`**: Contains Next.js API Route Handlers specific to this frontend application.
- **`components/`**: Shared components specific to this application (complementing `@op/ui`).
- **`lib/` or `utils/`**: Utility functions specific to this application.
- **`hooks/`**: Custom hooks specific to this application (complementing `@op/hooks`).
- **`store/`**: Contains state management logic, using Zustand.
- **`public/`**: Static assets like images and fonts.
- **`styles/`**: Global styles or SCSS files.
- **`next.config.js`**: Next.js configuration.
- **`postcss.config.js`, `tailwind.config.js`**: Configuration for PostCSS and Tailwind CSS.

## Key Technologies

- **Next.js**: React framework for building the frontend (App Router or Pages Router).
- **React**: UI library.
- **TypeScript**: For static typing.
- **`@op/ui`**: Consumes the shared UI component library.
- **`@op/hooks`**: Uses shared React hooks for logic and data fetching.
- **`@op/trpc`**: Integrates the tRPC client (`TRPCProvider.tsx`) to communicate with the backend API hosted by `apps/api`.
- **`@op/supabase`**: Uses the client-side Supabase client for authentication and potentially other direct Supabase interactions.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **Zustand**: Client-side state management library.
- **Sonner**: Library for displaying toasts/notifications.
- **Immer**: Utility for working with immutable state (often used with Zustand).
- **`babel-plugin-react-compiler`**: Experimental React compiler (Memoization).
- **`@next/bundle-analyzer`**: Tool for analyzing the webpack bundle size.

## Relationship to Other Workspaces

**Depends On:**

- **`@op/core`**: For shared configuration or types.
- **`@op/eslint-config` (Dev)**: For linting configuration.
- **`@op/hooks`**: Utilizes shared hooks.
- **`@op/supabase`**: Uses Supabase client utilities.
- **`@op/trpc`**: Imports the tRPC provider/client.
- **`@op/typescript-config` (Dev)**: For TypeScript configuration.
- **`@op/ui`**: Renders UI components provided by this package.

**Depended On By:**

- _(None - this is a final application)_

## Development

- Run `pnpm dev` to start the Next.js development server (on port 3100).
- Run `pnpm lint` to lint and type-check the code.
- Run `pnpm build` to create a production build.
- Run `pnpm start` to run the production build (on port 3100).

## Getting Started

First, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3100](http://localhost:3100) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This application defines its own API routes within the `app/api/` directory using [Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/router-handlers). For example, a file at `app/api/hello/route.ts` would map to [http://localhost:3100/api/hello](http://localhost:3100/api/hello).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn/foundations/about-nextjs) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_source=github.com&utm_medium=referral&utm_campaign=turborepo-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
