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

// Accounts on these domains are seeded test data, not people.
export const TEST_EMAIL_DOMAINS = ['test.local'];
