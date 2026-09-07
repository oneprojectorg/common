/**
 * Configuration specific to the personal data export pipeline.
 *
 * The bucket, the two time-to-live (TTL) values, and the download options are
 * shared with every other export and live in `services/exports/constants.ts`.
 * What is here is what only this pipeline uses: its cache key, its storage key,
 * its file name, and the row ceiling on one section of the file.
 */

/**
 * Builds the cache key for a personal data export's status record.
 *
 * Namespaced apart from the proposal export's `export:proposal:` keys. Both
 * pipelines mint their id with `randomUUID`, so a collision is not the risk; a
 * shared prefix would let one pipeline's status read parse the other's record
 * against the wrong schema, and report a live export as missing.
 *
 * @param exportId - The export the record belongs to.
 * @returns The namespaced key. Every reader and writer of the record uses this,
 *   so no call site holds its own copy of the format.
 */
export const personalDataExportCacheKey = (exportId: string) =>
  `export:personalData:${exportId}`;

/**
 * The storage key for a personal data export's file, relative to the exports
 * bucket.
 *
 * The shape is `<entity>/<id>/<sub-resource>/<file>`, matching the other
 * storage writers.
 *
 * Scoped by the subject's auth user id rather than their `users.id` because the
 * auth id is what the status record already carries, so a status read can
 * rebuild this key without a second lookup. Neither id is a secret the key
 * protects: the bucket is private and the signature is what grants access.
 *
 * @param authUserId - The data subject the export belongs to.
 * @param fileName - The generated file name, from
 *   {@link personalDataExportFileName}.
 * @returns The object key, relative to the exports bucket.
 */
export const personalDataExportFilePath = (
  authUserId: string,
  fileName: string,
) => `user/${authUserId}/personal-data/${fileName}`;

/**
 * The file name for a generated personal data export.
 *
 * The signed URL controls access, not this name. The exports bucket is private.
 * The full UUID stays as defence in depth, in case someone makes the bucket
 * public again — this file is one person's whole record, so a guessable name
 * would be the worst one to hand out.
 *
 * @returns A fresh name. Every call returns a different one.
 */
export const personalDataExportFileName = () =>
  `personal_data_export_${crypto.randomUUID()}_${Date.now()}.json`;

/**
 * Hard ceiling on the rows one section of the export may contain.
 *
 * Not a bound on process memory. The binding constraint is that the serialized
 * JSON crosses an Inngest step boundary on its way to the upload, so Inngest
 * serializes it into function state; this bounds that payload. Raising it means
 * streaming the file to storage rather than building it whole, so no complete
 * copy is ever held.
 *
 * Applied per section rather than to the file as a whole, so a subject with
 * thousands of reactions still gets every proposal they wrote. A section that
 * reaches the ceiling is named in the file and flagged on the export record: a
 * portability export that is quietly short is worse than one that failed,
 * because the subject has no way to tell it is incomplete.
 */
export const PERSONAL_DATA_EXPORT_MAX_ROWS_PER_SECTION = 10_000;
