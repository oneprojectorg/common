export const personalDataExportCacheKey = (exportId: string) =>
  `export:personalData:${exportId}`;

// Matches how long the app waits on a run. Also the claim's lifetime, so a stuck run frees up.
export const PERSONAL_DATA_EXPORT_MAX_RUN_MS = 30 * 60 * 1000;

// Names the user's running export. The run releases it when it ends.
export const personalDataExportActiveKey = (userId: string) =>
  `export:personalData:active:${userId}`;

export const personalDataExportFilePath = (
  authUserId: string,
  fileName: string,
) => `user/${authUserId}/personal-data/${fileName}`;

export const personalDataExportFileName = () =>
  `personal_data_export_${crypto.randomUUID()}_${Date.now()}.json`;

export const PERSONAL_DATA_EXPORT_MAX_ROWS_PER_SECTION = 10_000;

// Bounds the template lookups when a subject spans many decision instances.
export const PERSONAL_DATA_EXPORT_TEMPLATE_CONCURRENCY = 10;

// The app retires the offer on the same clock, from `completedAt`.
export const PERSONAL_DATA_EXPORT_FILE_LIFETIME_MS = 60 * 60 * 1000;

// Signed per download and used at once, so it never needs to outlive the click.
export const PERSONAL_DATA_EXPORT_URL_TTL_SECONDS = 60;
