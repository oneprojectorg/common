/**
 * Shared configuration for the proposal export pipeline.
 *
 * Three callers read and write the same export record and storage object: the
 * API service, the `@op/common` service layer, and the Inngest workflow. The
 * bucket name, key format, and TTLs have to agree across all three.
 *
 * They drifted once. The workflow minted a 2 hour signed URL but recorded a 24
 * hour expiry, so `getExportStatus` served a dead URL for 22 hours.
 */

/**
 * Exports are written to their own private bucket.
 *
 * An export CSV carries proposal submitter names, so it must not be readable
 * without a signature. That rules out the shared `assets` bucket, which is
 * public — `apps/app/next.config.mjs` rewrites `/assets/:path*` to its public
 * object root — and is why this is a bucket of its own rather than a prefix.
 * Do not point it back at the shared one.
 *
 * Provisioned `public: false` by `services/db/migrate.ts`, which also re-asserts
 * the visibility on every deploy. Signing here needs the service-role client:
 * `storage.objects` has RLS enabled and every policy on it is scoped to
 * `bucket_id = 'assets'`, so no policy grants a caller anything in this bucket
 * and a caller-scoped client cannot see the object at all. Each signing site
 * authorizes its own caller before it signs.
 */
export const EXPORTS_BUCKET = 'exports';

/**
 * Lifetime of a generated signed download URL.
 *
 * Shorter than {@link EXPORT_CACHE_TTL_SECONDS} on purpose. The export record
 * outlives any single URL, so an admin returning to a finished export gets a
 * fresh URL from `getExportStatus` instead of a 404.
 *
 * Because {@link EXPORTS_BUCKET} is private, this is a real revocation window:
 * once the signature lapses, no unsigned URL still resolves.
 */
export const EXPORT_URL_TTL_SECONDS = 6 * 60 * 60; // 6 hours

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

/**
 * Storage key for an export's generated file, relative to
 * {@link EXPORTS_BUCKET}.
 *
 * Shaped `<entity>/<id>/<sub-resource>/<file>`, matching the convention the
 * other storage writers follow. Leading with `proposals/` (as this did) reads
 * as though the owning entity were a proposal, when the export is scoped to a
 * process instance and covers many proposals.
 */
export const exportFilePath = (processInstanceId: string, fileName: string) =>
  `process/${processInstanceId}/proposals/${fileName}`;

/**
 * File name for a generated export.
 *
 * The signed URL is the access control, not this name — {@link EXPORTS_BUCKET}
 * is private. The full UUID stays as defence in depth against the bucket ever
 * being flipped back to public; the timestamp beside it is largely inferable and
 * contributes no unguessability of its own.
 *
 * `crypto.randomUUID()` is the global Web Crypto API, available in Node 19+ and
 * in browsers, so this module stays free of Node-only imports.
 */
export const exportFileName = (extension: string) =>
  `proposals_export_${crypto.randomUUID()}_${Date.now()}.${extension}`;

/**
 * `createSignedUrl` options that make an export download instead of render.
 *
 * Supabase serves a storage object inline unless the signed URL asks for an
 * attachment. A `text/csv` export then renders as text. Safari does this;
 * Chrome downloads it anyway, which hid the bug.
 *
 * The download button's `download` attribute cannot fix this. A browser ignores
 * that attribute on a cross-origin URL, and these links point at the Supabase
 * host.
 *
 * Both signing sites pass this. Either one alone leaves the other inline.
 */
export const exportDownloadOptions = (fileName: string) => ({
  download: fileName,
});
