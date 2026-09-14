/**
 * Configuration specific to the proposal export pipeline. The bucket, the TTLs,
 * and the download options are shared by every pipeline and live in
 * `services/exports/constants.ts`.
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
 * The storage key for a proposal export's generated file, relative to the
 * exports bucket.
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
 * @returns The object key, relative to the exports bucket.
 */
export const exportFilePath = (processInstanceId: string, fileName: string) =>
  `process/${processInstanceId}/proposals/${fileName}`;

/**
 * The file name for a generated proposal export.
 *
 * The signed URL controls access, not this name. The exports bucket is private.
 * The full UUID stays as defence in depth, in case someone makes the bucket
 * public again. A reader can infer the timestamp beside it, so the timestamp
 * adds no unguessability.
 *
 * `crypto.randomUUID()` is the global Web Crypto API. Node 19 and later provide
 * it, and browsers provide it. This module therefore needs no Node-only import.
 *
 * @param extension - File extension, with no leading dot. `csv` today.
 * @returns A fresh name. Every call returns a different one.
 */
export const exportFileName = (extension: string) =>
  `proposals_export_${crypto.randomUUID()}_${Date.now()}.${extension}`;
