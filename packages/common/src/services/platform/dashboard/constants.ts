export const DASHBOARD_PERIODS = [
  'month',
  'quarter',
  'ytd',
  'allTime',
] as const;

export const MONTH_PERIOD_DAYS = 30;
export const QUARTER_PERIOD_DAYS = 90;

/** A people-based value from this many users or fewer is not reported. */
export const MAX_SUPPRESSED_PEOPLE_COUNT = 3;

/** Survey results from fewer responses than this are not reported. */
export const MIN_SURVEY_RESPONSES = 10;

/** Every money figure is in this currency, in upper case. */
export const EXPECTED_CURRENCY = 'USD';

/** A currency that is not a three-letter code is reported as this text. */
export const OTHER_CURRENCY = 'OTHER';

// No real budget is near this, and a sum of such amounts stays far inside the
// float8 range, so a larger amount is treated as unreadable.
export const MAX_COUNTED_AMOUNT = 1e12;

/** The most currency codes a money warning lists. */
export const MAX_REPORTED_CURRENCIES = 5;

/** The most process instance ids a money warning log lists. */
export const MAX_LOGGED_PROCESS_INSTANCE_IDS = 20;

// Accounts on these domains are seeded test data, not people.
export const TEST_EMAIL_DOMAINS = ['test.local'];

// Increase when the payload shape or a counting rule changes.
export const DASHBOARD_METRICS_CACHE_VERSION = 2;

export const DASHBOARD_METRICS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
