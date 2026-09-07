/**
 * Namespaced apart from the proposal export's keys. A shared prefix would let
 * either status read parse the other's record against the wrong schema.
 */
export const personalDataExportCacheKey = (exportId: string) =>
  `export:personalData:${exportId}`;

/**
 * Keyed by auth user id because that is what the status record already carries,
 * so a read can rebuild the path without a second lookup.
 */
export const personalDataExportFilePath = (
  authUserId: string,
  fileName: string,
) => `user/${authUserId}/personal-data/${fileName}`;

/** Full UUID as defence in depth: this file is one person's whole record. */
export const personalDataExportFileName = () =>
  `personal_data_export_${crypto.randomUUID()}_${Date.now()}.json`;

/**
 * Per-section ceiling on the rows one export may hold. The serialized JSON
 * crosses an Inngest step boundary into function state, which is what bounds it.
 * A section that reaches the ceiling is named in the file and on the record.
 */
export const PERSONAL_DATA_EXPORT_MAX_ROWS_PER_SECTION = 10_000;
