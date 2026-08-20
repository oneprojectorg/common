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
 * Exports are written to their own private bucket.
 *
 * An export CSV carries proposal submitter names, so it must not be readable
 * without a signature. That rules out the shared `assets` bucket, which is
 * public — `apps/app/next.config.mjs` rewrites `/assets/:path*` to its public
 * object root — and is why this is a bucket of its own rather than a prefix.
 * Do not point it back at the shared one.
 *
 * Provisioned `public: false` by `services/db/migrate.ts`, which also re-asserts
 * the visibility on every deploy. There are no `storage.objects` RLS policies,
 * so signing here needs the service-role client: a caller-scoped client cannot
 * see the object at all. Each signing site authorizes its own caller first.
 */
export const EXPORTS_BUCKET = 'exports';

/**
 * Lifetime of a generated signed download URL.
 *
 * Deliberately shorter than {@link EXPORT_CACHE_TTL_SECONDS}: the export record
 * outlives any single URL, so an admin returning to a finished export gets a
 * freshly minted URL from `getExportStatus` instead of a 404.
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
