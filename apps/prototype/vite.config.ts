import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const src = fileURLToPath(new URL('./src', import.meta.url));

/**
 * PROTOTYPE ONLY.
 *
 * A plain React SPA so the prototype can be built into one self-contained HTML
 * file and shared. It depends on `@op/sense` and `@op/styles` as workspace
 * siblings, which is the whole point: the fidelity comes from using the real
 * design system rather than a copy of it.
 *
 * No `@vitejs/plugin-react`: esbuild compiles TSX with the automatic JSX runtime
 * on its own. That costs Fast Refresh — a full reload on save instead — and buys
 * a build with no dependency outside what the monorepo already installs.
 */
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    // One React, always. `@op/sense` is a linked workspace package with its own
    // copy in node_modules; two copies in one bundle means every hook call from
    // a sense component throws "Invalid hook call".
    dedupe: ['react', 'react-dom'],
    alias: {
      // `@/…` keeps the screens' own imports untouched: the shims sit at the
      // same paths the app used, so nothing inside the copied trees changed.
      '@': src,
      'next/navigation': `${src}/shims/next-navigation.ts`,
      'next-intl': `${src}/shims/next-intl.ts`,
    },
  },
  // `@op/sense` exports raw TSX from source, so it is compiled rather than
  // pre-bundled as an opaque dependency.
  optimizeDeps: { exclude: ['@op/sense', '@op/styles'] },
  build: {
    target: 'es2022',
    // Everything inlined: a shared HTML file has no sibling assets to fetch.
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 8000,
  },
});
