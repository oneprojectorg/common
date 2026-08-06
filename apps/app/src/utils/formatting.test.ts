import { describe, expect, it } from 'vitest';

import {
  DATE_TIME_UTC_FORMAT,
  formatCurrency,
  formatDate,
  formatDateRange,
  formatNumber,
} from './formatting';

/**
 * Runs `render` with the process timezone pinned, standing in for the two
 * halves of a hydration pass: the server renders in UTC, the browser renders in
 * the viewer's zone. Any difference between the two is a React #418 mismatch.
 */
const inTimeZone = <T>(timeZone: string, render: () => T): T => {
  const previous = process.env.TZ;
  process.env.TZ = timeZone;
  try {
    return render();
  } finally {
    if (previous === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previous;
    }
  }
};

// Midnight in America/New_York, i.e. how process phase dates are stored. In any
// zone west of the stored offset this instant lands on the previous day.
const PHASE_START = '2026-07-06T04:00:00.000Z';
const PHASE_END = '2026-08-28T04:00:00.000Z';

describe('formatDate', () => {
  it('renders the same day in every viewer timezone', () => {
    const zones = [
      'UTC',
      'America/New_York',
      'America/Los_Angeles',
      'Pacific/Honolulu',
      'Asia/Tokyo',
    ];

    const rendered = zones.map((zone) =>
      inTimeZone(zone, () => formatDate(PHASE_START)),
    );

    expect(new Set(rendered)).toEqual(new Set(['Jul 6, 2026']));
  });

  it('keeps an explicit timeZone option', () => {
    const rendered = inTimeZone('America/Los_Angeles', () =>
      formatDate(PHASE_START, 'en-US', DATE_TIME_UTC_FORMAT),
    );

    expect(rendered).toContain('Jul 6, 2026');
  });
});

describe('number formatting', () => {
  // Node's default ICU locale can't be swapped at runtime the way TZ can, so
  // this pins the contract instead: both helpers name a locale rather than
  // letting Intl fall through to the runtime default, which differs between
  // the SSR process and the browser.
  it('formats against a pinned locale, not the runtime default', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatCurrency(1234567)).toBe('$1,234,567');
  });
});

describe('formatDateRange', () => {
  it('renders the same range in every viewer timezone', () => {
    const inUtc = inTimeZone('UTC', () =>
      formatDateRange(PHASE_START, PHASE_END),
    );
    const inPacific = inTimeZone('America/Los_Angeles', () =>
      formatDateRange(PHASE_START, PHASE_END),
    );

    expect(inUtc).toBe('Jul 6 - Aug 28');
    expect(inPacific).toBe(inUtc);
  });
});
