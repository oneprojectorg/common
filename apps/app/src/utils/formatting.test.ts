import { afterEach, describe, expect, it } from 'vitest';

import {
  formatCurrency,
  formatDate,
  formatDateRange,
  formatDeadline,
  formatNumber,
} from './formatting';

const originalTimeZone = process.env.TZ;

/**
 * Re-runs `read` with the process pinned to `timeZone`.
 *
 * Node re-reads `process.env.TZ` on the next date/Intl operation, so this
 * reproduces what a browser west of UTC renders while the server sits in UTC —
 * the exact pair of renders that has to agree for hydration to succeed.
 */
const inTimeZone = <T>(timeZone: string, read: () => T): T => {
  process.env.TZ = timeZone;
  try {
    return read();
  } finally {
    process.env.TZ = originalTimeZone;
  }
};

afterEach(() => {
  process.env.TZ = originalTimeZone;
});

// Production stores phase dates at midnight Eastern, so the UTC instant lands
// in the small hours — the window where an unpinned formatter disagrees.
const MIDNIGHT_EASTERN = '2026-07-06T04:00:00.000Z';

describe('formatDate', () => {
  it('renders the same day in a western time zone as in UTC', () => {
    const utc = inTimeZone('UTC', () => formatDate(MIDNIGHT_EASTERN));
    const pacific = inTimeZone('America/Los_Angeles', () =>
      formatDate(MIDNIGHT_EASTERN),
    );

    expect(utc).toBe('Jul 6, 2026');
    expect(pacific).toBe(utc);
  });

  it('keeps a caller-supplied option set pinned to the same day', () => {
    const short = { month: 'long', day: 'numeric' } as const;

    expect(
      inTimeZone('America/Los_Angeles', () =>
        formatDate(MIDNIGHT_EASTERN, 'en-US', short),
      ),
    ).toBe('July 6');
  });

  it('honours an explicit time zone in the options', () => {
    expect(
      formatDate(MIDNIGHT_EASTERN, 'en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'America/Los_Angeles',
      }),
    ).toBe('Jul 5');
  });
});

describe('formatDeadline', () => {
  // A phase end is enforced at this exact instant: the transition is scheduled
  // for it and the cron fires the moment it comes due. So the string has to
  // tell each viewer the wall-clock time they actually have to beat.
  it('gives each viewer their own wall-clock cutoff for one instant', () => {
    expect(formatDeadline(MIDNIGHT_EASTERN, 'en-US', 'America/New_York')).toBe(
      'Jul 6, 12:00 AM EDT',
    );
    expect(
      formatDeadline(MIDNIGHT_EASTERN, 'en-US', 'America/Los_Angeles'),
    ).toBe('Jul 5, 9:00 PM PDT');
  });

  it('names the zone so a bare date can never be read as local midnight', () => {
    expect(formatDeadline(MIDNIGHT_EASTERN)).toContain('UTC');
  });
});

describe('formatDateRange', () => {
  it('renders the same range in a western time zone as in UTC', () => {
    const range = () =>
      formatDateRange(MIDNIGHT_EASTERN, '2026-08-28T04:00:00.000Z');

    expect(inTimeZone('UTC', range)).toBe('Jul 6 - Aug 28');
    expect(inTimeZone('America/Los_Angeles', range)).toBe('Jul 6 - Aug 28');
  });
});

describe('formatNumber', () => {
  it('groups against a named locale rather than the runtime default', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(1234567, 'de-DE')).toBe('1.234.567');
  });
});

describe('formatCurrency', () => {
  it('formats against a named locale rather than the runtime default', () => {
    expect(formatCurrency(1500)).toBe('$1,500');
  });
});
