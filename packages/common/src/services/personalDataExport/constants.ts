export const personalDataExportCacheKey = (exportId: string) =>
  `export:personalData:${exportId}`;

// How long the app waits on a run and the claim lives. The Inngest run is cancelled inside it.
export const PERSONAL_DATA_EXPORT_MAX_RUN_MS = 30 * 60 * 1000;

export const PERSONAL_DATA_EXPORT_MAX_QUEUE_MS = 5 * 60 * 1000;

// Inngest lets a step in flight finish past the deadline; this is the default Vercel request limit.
const PERSONAL_DATA_EXPORT_MAX_STEP_MS = 5 * 60 * 1000;

export const PERSONAL_DATA_EXPORT_MAX_EXECUTION_MS =
  PERSONAL_DATA_EXPORT_MAX_RUN_MS -
  PERSONAL_DATA_EXPORT_MAX_QUEUE_MS -
  PERSONAL_DATA_EXPORT_MAX_STEP_MS;

// Names the user's export a repeat request reuses: running, or completed with a live file.
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

// Ends reuse a minute before the app retires the offer, so a reused export is never already gone.
export const PERSONAL_DATA_EXPORT_REUSE_MS =
  PERSONAL_DATA_EXPORT_FILE_LIFETIME_MS - 60 * 1000;

// Signed per download and used at once, so it never needs to outlive the click.
export const PERSONAL_DATA_EXPORT_URL_TTL_SECONDS = 60;
