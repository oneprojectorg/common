/**
 * Shared configuration for the proposal export pipeline.
 *
 * The API service, the `@op/common` service layer, and the Inngest workflow
 * share one export record and one storage object. The bucket name, the key
 * format, and the time-to-live (TTL) values must agree across all three.
 *
 * These values drifted once. The workflow signed a URL for 2 hours. It recorded
 * a 24 hour expiry. `getExportStatus` then served a dead URL for 22 hours.
 */

/**
 * The private bucket that holds every generated export.
 *
 * An export CSV carries proposal submitter names. A reader must present a
 * signature to get one. The shared `assets` bucket cannot hold these files,
 * because `apps/app/next.config.mjs` rewrites `/assets/:path*` to its public
 * object root. Use a separate bucket, not a prefix inside `assets`. Do not
 * point this constant back at `assets`.
 *
 * `services/db/migrate.ts` creates this bucket with `public: false`. It also
 * re-asserts the visibility on every deploy.
 *
 * A signing call needs the service-role client. Supabase enables row level
 * security (RLS) on `storage.objects`, and every policy scopes to
 * `bucket_id = 'assets'`. No policy grants a caller any access here, so a
 * caller-scoped client cannot see the object. Authorization runs before each
 * signing call: in `getExportStatus` for a read, and in the export mutation for
 * the workflow.
 */
export const EXPORTS_BUCKET = 'exports';

/**
 * The lifetime of a generated signed download URL.
 *
 * This value is shorter than {@link EXPORT_CACHE_TTL_SECONDS} on purpose. The
 * export record outlives any single URL. An admin who returns to a finished
 * export gets a new URL from `getExportStatus` instead of a 404.
 *
 * {@link EXPORTS_BUCKET} is private, so expiry revokes access to the objects it
 * holds. Expiry does not cover the exports written before the move. Those
 * objects stay in the public `assets` bucket, and a reader who knows the path
 * can still read them. Asana 1217696316242182 tracks the deletion. This comment
 * is the only record of that exposure in the tree.
 */
export const EXPORT_URL_TTL_SECONDS = 6 * 60 * 60; // 6 hours

/**
 * The lifetime of the cached export status record.
 *
 * Export state lives only in the cache. No table backs it. This value is
 * therefore also how long a completed export stays downloadable.
 *
 * Keep this value longer than {@link EXPORT_URL_TTL_SECONDS}. A shorter value
 * expires the record before the URL it holds. That makes the refresh path in
 * `getExportStatus` unreachable.
 */
export const EXPORT_CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Builds the cache key for an export's status record.
 *
 * @param exportId - The export the record belongs to.
 * @returns The namespaced key. Every reader and writer of the record uses this,
 *   so no call site holds its own copy of the format.
 */
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
 * The storage key for an export's generated file, relative to
 * {@link EXPORTS_BUCKET}.
 *
 * The shape is `<entity>/<id>/<sub-resource>/<file>`. It matches the shape the
 * other storage writers use.
 *
 * This key led with `proposals/` before. That shape reads as though a proposal
 * owned the export. A process instance owns the export, and one export covers
 * many proposals.
 *
 * @param processInstanceId - The instance that owns the export.
 * @param fileName - The generated file name, from {@link exportFileName}.
 * @returns The object key, relative to {@link EXPORTS_BUCKET}.
 */
export const exportFilePath = (processInstanceId: string, fileName: string) =>
  `process/${processInstanceId}/proposals/${fileName}`;

/**
 * The file name for a generated export.
 *
 * The signed URL controls access, not this name. {@link EXPORTS_BUCKET} is
 * private. The full UUID stays as defence in depth, in case someone makes the
 * bucket public again. A reader can infer the timestamp beside it, so the
 * timestamp adds no unguessability.
 *
 * `crypto.randomUUID()` is the global Web Crypto API. Node 19 and later provide
 * it, and browsers provide it. This module therefore needs no Node-only import.
 *
 * @param extension - File extension, with no leading dot. `csv` today.
 * @returns A fresh name. Every call returns a different one.
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
 *
 * @param fileName - Name the browser saves the object under.
 * @returns Options for `createSignedUrl`, which put the name in the signed URL's
 *   `download` parameter.
 */
export const exportDownloadOptions = (fileName: string) => ({
  download: fileName,
});
