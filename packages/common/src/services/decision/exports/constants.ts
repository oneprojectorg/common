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

import { ASSETS_BUCKET } from '../../../utils/storage';

/**
 * Exports are written to the shared `assets` bucket.
 *
 * Aliased from {@link ASSETS_BUCKET} rather than repeating the literal, so a
 * future migration to per-feature buckets stays the single-file change that
 * constant promises. Renaming the bucket in one place and not the other would
 * strand every export.
 *
 * `assets` is public: `apps/app/next.config.mjs` rewrites `/assets/:path*` to
 * the bucket's public object root, and `getPublicUrl()` builds every avatar and
 * organization image URL from it. So an export object is readable by anyone who
 * has its path — the CSV carries submitter names and email addresses, and the
 * only thing standing between it and an anonymous reader is that the key is not
 * enumerable.
 *
 * The signed URLs minted downstream are therefore a convenience (they expire,
 * so a shared link goes stale) rather than an access boundary: the unsigned
 * public URL for the same object resolves regardless of signature. Treat the
 * random component of the generated file name — minted in the export
 * workflow's `upload-to-storage` step — as the actual control, and do not
 * weaken it.
 */
export const EXPORTS_BUCKET = ASSETS_BUCKET;

/**
 * Lifetime of a generated signed download URL.
 *
 * Deliberately shorter than {@link EXPORT_CACHE_TTL_SECONDS}: the export record
 * outlives any single URL, so an admin returning to a finished export gets a
 * freshly minted URL from `getExportStatus` instead of a 404.
 *
 * Note this bounds the *signed* URL only. Objects live in the public `assets`
 * bucket (see {@link EXPORTS_BUCKET}), so expiry does not revoke access to the
 * underlying file — it only invalidates the signature on this particular link.
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
 * Rows requested per `listProposals` call while assembling an export.
 *
 * Sized for the round trip, not the result. Export reads set
 * `includeDocumentContent`, so every row carries the proposal's full TipTap
 * fragments — by far the heaviest column we select. A larger page buys fewer
 * queries at a steep cost in peak memory per query, and the queries are not the
 * expensive part.
 */
export const EXPORT_PAGE_SIZE = 500;

/**
 * Hard ceiling on the rows one export may contain.
 *
 * Not a bound on process memory. The binding constraint is that the generated
 * CSV crosses an Inngest step boundary on its way to `upload-to-storage`, so
 * Inngest serializes it into function state; this bounds that payload. Raising
 * it means moving CSV generation and upload into one step and appending per
 * page, so no complete copy is ever held.
 *
 * Reaching it is never silent. `listProposalsForExport` logs a warning and
 * returns `truncated: true`, which travels through the export record to the
 * admin's download so the person holding the file learns it is short. A
 * plausible-but-incomplete CSV is worse than a failed export.
 */
export const EXPORT_MAX_ROWS = 5_000;

/**
 * Storage key for an export's generated file, relative to
 * {@link EXPORTS_BUCKET}.
 *
 * Shaped `<entity>/<id>/<sub-resource>/<file>` to match the other writers
 * sharing this bucket — `profile/${profileId}/resources/` and
 * `profiles/${profileId}/${imageType}/`. Leading with `proposals/` (as this
 * did) reads as though the owning entity were a proposal, when the export is
 * scoped to a process instance and covers many proposals.
 */
export const exportFilePath = (processInstanceId: string, fileName: string) =>
  `process/${processInstanceId}/proposals/${fileName}`;

/**
 * File name for a generated export.
 *
 * The random component is the access control for these objects. They live in
 * the public {@link EXPORTS_BUCKET}, so anyone holding this name can read the
 * CSV — and the CSV carries submitter names and email addresses. A whole UUID
 * is used rather than a truncation of one: the timestamp beside it is largely
 * inferable, so the UUID has to carry the unguessability by itself.
 *
 * `crypto.randomUUID()` is the global Web Crypto API, available in Node 19+ and
 * in browsers, so this module stays free of Node-only imports.
 */
export const exportFileName = (extension: string) =>
  `proposals_export_${crypto.randomUUID()}_${Date.now()}.${extension}`;
