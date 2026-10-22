export const personalDataExportCacheKey = (exportId: string) =>
  `export:personalData:${exportId}`;

export const personalDataExportFilePath = (
  authUserId: string,
  fileName: string,
) => `user/${authUserId}/personal-data/${fileName}`;

export const personalDataExportFileName = () =>
  `personal_data_export_${crypto.randomUUID()}_${Date.now()}.json`;

export const PERSONAL_DATA_EXPORT_MAX_ROWS_PER_SECTION = 10_000;

// Bounds the template lookups when a subject spans many decision instances.
export const PERSONAL_DATA_EXPORT_TEMPLATE_CONCURRENCY = 10;
