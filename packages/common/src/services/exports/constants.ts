// Private, unlike `assets`. Proposal exports written to `assets` before the move
// still exist there (Asana 1217696316242182).
export const EXPORTS_BUCKET = 'exports';

// Shorter than the cache TTL so a returning reader gets a fresh URL.
export const EXPORT_URL_TTL_SECONDS = 6 * 60 * 60;

export const EXPORT_CACHE_TTL_SECONDS = 24 * 60 * 60;
