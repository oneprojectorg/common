# Common

This is an official monorepo for Common.

- `api`: a [Next.js](https://nextjs.org/) app used as an entrypoint for tRPC routes
- `app`: a [Next.js](https://nextjs.org/) app
- `@op/ui`: a stub React component library with dedicated `Storybook` interface
- `@op/eslint-config`: `eslint` configurations
- `@op/typescript-config`: `tsconfig.json`s used throughout the monorepo

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

### Setup

- Make sure you're using Node 18+
- Run `corepack enable` to activate [Corepack](https://nodejs.org/api/corepack.html)
- Run `pnpm installs` in the project root to install dependencies

### Tailwind Integration

This repository is set up to consume styles on-the-fly for `@op/ui` components. The component `.tsx` files are consumed by the Next.js apps directly using `transpilePackages` in `next.config.js`. This was chosen for several reasons:

- Make sharing one `tailwind.shared.ts` to apps and packages as easy as possible.
- Make package development simple by only depending on the Next.js Compiler and `tailwindcss`.
- Maintain clear package export boundaries.
- Consume `packages/ui` directly from source without building.

With this strategy we can remove all Tailwind dependencies from the `ui` package and future **packages** that use Tailwind. Instead include `tailwindcss`, `autoprefixer`, and `postcss` in your consuming app as `devDependencies`.

### Consuming Tailwind-powered packages/\*

If you're working on an `[app]` that imports other `packages/*` that depend on Tailwind, you will need to update the `tailwind.config.ts` and `next.config.mjs` in your `apps/[app]`. This allows the `[app]` to be aware of your `packages/*` locations, so it can find all usages of the `tailwindcss` class names for CSS compilation.

First step is to update `packagesUsingTailwind` in `pacakges/ui/tailwind.utils.mjs` so that it includes all the `pacakges/*` that use Tailwind. The key is the name of the package as defined in it's `pacakge.json` manifest, and the path is the [glob](<https://en.wikipedia.org/wiki/Glob_(programming)>) associated with its source files.

```ts
// configs/tailwind-config/utils.mjs

const packagesUsingTailwind = {
  '@op/ui': '../../packages/ui/src/**.{js,ts,jsx,tsx}',
  // ...
};
```

Then in your consuming app simply import `withUITailwindPreset` from `@op/ui/utils` and wrap your Tailwind config with it, to automatically inject the paths to `content`:

```ts
import sharedConfig from '@op/ui/tailwind-config';
// @ts-ignore ignore undeclared types
import { withUITailwindPreset } from '@op/ui/tailwind-utils';

import type { Config } from 'tailwindcss';

const config: Pick<Config, 'content' | 'presets'> = {
  content: ['./app/**/*.tsx'],
  presets: [sharedConfig],
};

export default withUITailwindPreset(config);
```

Similarly in your consuming app import `withTranspiledWorkspacesForNext` from `@op/ui/utils` and wrap your Next.js config with it, to automatically inject the package name to `transpilePackages`:

```ts
import { withTranspiledWorkspacesForNext } from '@op/ui/tailwind-utils';

/** @type {import('next').NextConfig} */
const config = {};

export default withTranspiledWorkspacesForNext(config);
```

This approach allows us to have a single source of truth to quickly integrate our apps with our Tailwind-powered packages without the need for building/rebuilding while utilizing [HMR](https://webpack.js.org/concepts/hot-module-replacement/) functionality of our development environment.
