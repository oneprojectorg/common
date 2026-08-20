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
 * without a signature. This deliberately does *not* reuse the shared `assets`
 * bucket, which is public: `apps/app/next.config.mjs` rewrites `/assets/:path*`
 * to that bucket's public object root, and `getPublicUrl()` builds every avatar
 * and organization image URL from it. An export written there was readable by
 * any anonymous caller who held the path, which made the signed URLs downstream
 * link expiry rather than an access boundary — the unsigned public URL for the
 * same object resolved regardless of signature.
 *
 * The bucket is provisioned with `public: false` in three places that have to
 * agree: `services/db/migrate.ts` for hosted environments, the
 * `[storage.buckets.exports]` block in each `supabase/*.toml` for local and CI
 * stacks, and `services/db/seed-test.ts` for test runs. A signed URL is
 * therefore the only way to read an object. Do not point this back at the
 * shared bucket.
 *
 * There are no `storage.objects` RLS policies, so signing an object here needs
 * the service-role client — a caller-scoped client cannot see the object and
 * its `createSignedUrl` fails. Both signing sites use it, and each authorizes
 * the request itself before signing.
 */
export const EXPORTS_BUCKET = 'exports';

/**
 * Lifetime of a generated signed download URL.
 *
 * Shorter than {@link EXPORT_CACHE_TTL_SECONDS} on purpose. The export record
 * outlives any single URL, so an admin returning to a finished export gets a
 * fresh URL from `getExportStatus` instead of a 404.
 *
 * Objects live in a private bucket (see {@link EXPORTS_BUCKET}), so this is a
 * real revocation window rather than cosmetic link rot: once the signature
 * lapses there is no unsigned URL that still resolves.
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
 * Shaped `<entity>/<id>/<sub-resource>/<file>` to match the other writers on
 * this bucket: `profile/${profileId}/resources/` and
 * `profiles/${profileId}/${imageType}/`.
 *
 * Leading with `proposals/`, as this did, reads as though a proposal owned the
 * file. The export is scoped to a process instance and covers many proposals.
 */
export const exportFilePath = (processInstanceId: string, fileName: string) =>
  `process/${processInstanceId}/proposals/${fileName}`;

/**
 * File name for a generated export.
 *
 * {@link EXPORTS_BUCKET} is private, so the signed URL — not this name — is the
 * access control. The random component is kept as defence in depth: it means a
 * leaked object path is not by itself enough to name another instance's export
 * if the bucket is ever misconfigured back to public. A whole UUID is used
 * rather than a truncation of one, since the timestamp beside it is largely
 * inferable and cannot contribute unguessability.
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
