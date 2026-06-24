// Platform-supported locales matching the i18n dictionaries.
// Shared between TypeScript code and build-time scripts (e.g. next.config.mjs)
// — mirrors the @op/core/previews.mjs pattern.

/** @type {readonly ['en', 'es', 'fr', 'pt', 'bn', 'so', 'ar']} */
export const SUPPORTED_LOCALES = Object.freeze([
  'en',
  'es',
  'fr',
  'pt',
  'bn',
  'so',
  'ar',
]);
