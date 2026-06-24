// Build-time mirror of `SUPPORTED_LOCALES` in
// `src/services/translation/locales.ts`. Imported by `apps/app/next.config.mjs`
// (which cannot read the TS file). Lives at the package root rather than next
// to the TS source so it does not shadow `./locales` lookups inside the
// package. Kept in lockstep with the TS source by
// `src/services/translation/locales.test.ts`.

export const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'pt', 'bn', 'so', 'ar'];
