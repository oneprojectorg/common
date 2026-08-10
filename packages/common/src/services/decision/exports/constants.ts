/**
 * Shared configuration for the proposal export pipeline.
 *
 * The API service, the `@op/common` service layer, and the Inngest workflow all
 * read and write the same export record and the same storage object, so the
 * bucket name, key format, and TTLs have to agree across all three. They
 * previously drifted — the workflow minted a 2 hour signed URL but recorded a
 * 24 hour expiry, so `getExportStatus` served a dead URL for the 22 hours in
 * between.
 */

/**
 * Exports live in their own private bucket, NOT in `assets`.
 *
 * `assets` is public by necessity: `apps/app/next.config.mjs` rewrites
 * `/assets/:path*` to the bucket's public object root, and `getPublicUrl()`
 * builds every avatar and organization image URL from it. Anything written
 * there is world-readable by path, which is unacceptable for exports — the
 * proposal CSV carries submitter names and email addresses. Keeping exports in
 * a private bucket is what makes the signed URLs below an actual access
 * boundary rather than decoration.
 */
export const EXPORTS_BUCKET = 'exports';

/**
 * Lifetime of a generated signed download URL.
 *
 * Deliberately shorter than {@link EXPORT_CACHE_TTL_SECONDS}: the export record
 * outlives any single URL, so an admin returning to a finished export gets a
 * freshly minted URL from `getExportStatus` instead of a 404.
 */
export const EXPORT_URL_TTL_SECONDS = 2 * 60 * 60; // 2 hours

/**
 * Lifetime of the cached export status record.
 *
 * Export state is cache-only — there is no backing table — so this is also how
 * long a completed export stays downloadable. Must stay longer than
 * {@link EXPORT_URL_TTL_SECONDS} or the signed-URL refresh path in
 * `getExportStatus` is unreachable, because the record would expire before the
 * URL it holds.
 */
export const EXPORT_CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours

/** Cache key for an export's status record. */
export const exportStatusCacheKey = (exportId: string) =>
  `export:proposal:${exportId}`;

/** Storage key for an export's generated file, relative to {@link EXPORTS_BUCKET}. */
export const exportFilePath = (processInstanceId: string, fileName: string) =>
  `proposals/${processInstanceId}/${fileName}`;
