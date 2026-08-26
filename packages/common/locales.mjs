// Single source of truth for the platform-supported locales. Imported by
// TypeScript callers (re-exported through `src/services/translation/locales.ts`)
// and by build-time consumers like `apps/app/next.config.mjs` that cannot read
// TS. Lives at the package root rather than under `src/` so it cannot shadow
// `./locales` lookups inside the package.

/** @type {readonly ['en', 'es', 'fr', 'pt', 'bn', 'so', 'ar', 'hu']} */
export const SUPPORTED_LOCALES = [
  'en',
  'es',
  'fr',
  'pt',
  'bn',
  'so',
  'ar',
  'hu',
];
