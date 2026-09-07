/**
 * Storage and lifetime configuration shared by every export pipeline. Each
 * pipeline owns its own cache key, storage key, and file name; these must agree
 * across all of them, and drifted once into a dead-download bug.
 */

/**
 * Private bucket for generated exports. Not the `assets` bucket, which
 * `apps/app/next.config.mjs` serves publicly. `services/db/migrate.ts` creates
 * it and re-asserts `public: false` on every deploy.
 */
export const EXPORTS_BUCKET = 'exports';

/**
 * Kept shorter than {@link EXPORT_CACHE_TTL_SECONDS} so the record outlives any
 * one URL and a returning reader gets a fresh signature instead of a 404.
 */
export const EXPORT_URL_TTL_SECONDS = 6 * 60 * 60;

/**
 * Export state lives only in the cache, so this is also how long a completed
 * export stays downloadable.
 */
export const EXPORT_CACHE_TTL_SECONDS = 24 * 60 * 60;

/**
 * Supabase serves an object inline unless the signed URL asks for an attachment,
 * and a link's `download` attribute is inert cross-origin. Every signing site
 * passes this.
 */
export const exportDownloadOptions = (fileName: string) => ({
  download: fileName,
});
