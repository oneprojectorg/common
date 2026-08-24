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

import { ASSETS_BUCKET } from '../../../utils/storage';

/**
 * Exports are written to the shared `assets` bucket.
 *
 * Aliased from {@link ASSETS_BUCKET} rather than repeating the literal. A future
 * migration to per-feature buckets then stays the single-file change that
 * constant promises. Renaming one and not the other would strand every export.
 *
 * `assets` is public. `apps/app/next.config.mjs` rewrites `/assets/:path*` to
 * the bucket's public object root, and `getPublicUrl()` builds every avatar and
 * organization image URL from it.
 *
 * So anyone holding an export's path can read it. The CSV carries submitter
 * names. Only an unguessable key stands between it and an anonymous reader.
 *
 * The signed URLs downstream are a convenience, not an access boundary. They
 * expire, so a shared link goes stale, but the unsigned public URL for the same
 * object resolves regardless of signature.
 *
 * Treat the random part of the file name as the actual control. The export
 * workflow mints it in its `upload-to-storage` step. Do not weaken it.
 */
export const EXPORTS_BUCKET = ASSETS_BUCKET;

/**
 * Lifetime of a generated signed download URL.
 *
 * Shorter than {@link EXPORT_CACHE_TTL_SECONDS} on purpose. The export record
 * outlives any single URL, so an admin returning to a finished export gets a
 * fresh URL from `getExportStatus` instead of a 404.
 *
 * This bounds the *signed* URL only. Objects live in the public `assets` bucket
 * (see {@link EXPORTS_BUCKET}), so expiry does not revoke access to the file. It
 * invalidates the signature on this link.
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
 * The random component is the access control for these objects. They live in
 * the public {@link EXPORTS_BUCKET}, so anyone holding this name can read the
 * CSV, and the CSV carries submitter names.
 *
 * Uses a whole UUID, not a truncation. The timestamp beside it is largely
 * inferable, so the UUID carries the unguessability by itself.
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
