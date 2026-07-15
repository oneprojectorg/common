import { describe, expect, it } from 'vitest';

import { formatDate, formatDateRange, formatPhaseDate } from './formatting';

/**
 * Phase dates are stored as the author's local midnight serialized to ISO
 * (ProcessBuilder's `formatDateValue`), so each case below is "author in
 * timezone X picked July 15, 2026" expressed as the instant that gets stored.
 */
describe('formatPhaseDate', () => {
  it('recovers the picked day for an author east of UTC (Berlin, UTC+2)', () => {
    expect(formatPhaseDate('2026-07-14T22:00:00.000Z')).toBe('Jul 15');
  });

  it('recovers the picked day for an author west of UTC (New York, UTC-4)', () => {
    expect(formatPhaseDate('2026-07-15T04:00:00.000Z')).toBe('Jul 15');
  });

  it('recovers the picked day for a UTC author', () => {
    expect(formatPhaseDate('2026-07-15T00:00:00.000Z')).toBe('Jul 15');
  });

  it('recovers the picked day at the eastern edge (Auckland winter, UTC+12)', () => {
    expect(formatPhaseDate('2026-07-14T12:00:00.000Z')).toBe('Jul 15');
  });

  it('recovers the picked day at the western edge (Pago Pago, UTC-11)', () => {
    expect(formatPhaseDate('2026-07-15T11:00:00.000Z')).toBe('Jul 15');
  });

  it('passes formatting options through', () => {
    expect(
      formatPhaseDate('2026-07-14T22:00:00.000Z', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
    ).toBe('July 15, 2026');
  });

  it('formats in the requested locale', () => {
    expect(
      formatPhaseDate(
        '2026-07-14T22:00:00.000Z',
        { month: 'long', day: 'numeric' },
        'es-ES',
      ),
    ).toContain('julio');
  });

  // Documents the known ceiling of the ±12h heuristic (see TODO in
  // formatPhaseDate): an author at UTC+13 (e.g. New Zealand during DST,
  // picking Jan 15) still renders the previous day. If this assertion starts
  // failing, the heuristic changed — update the TODO and the docs with it.
  it('KNOWN LIMITATION: shows the previous day for authors at UTC+13/+14', () => {
    expect(formatPhaseDate('2026-01-14T11:00:00.000Z')).toBe('Jan 14');
  });
});

describe('formatDate', () => {
  it('formats the UTC calendar day regardless of environment timezone', () => {
    // 23:30 UTC — already "tomorrow" east of UTC, still "today" west of it.
    // Pinning to UTC keeps SSR and client output identical (React #418).
    expect(formatDate('2026-07-06T23:30:00.000Z')).toBe('Jul 6');
  });

  it('lets callers override the timezone', () => {
    expect(
      formatDate('2026-07-07T00:30:00.000Z', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
      }),
    ).toBe('Jul 6');
  });
});

describe('formatDateRange', () => {
  it('applies the phase-date shift to both ends', () => {
    expect(
      formatDateRange('2026-07-14T22:00:00.000Z', '2026-07-28T22:00:00.000Z'),
    ).toBe('Jul 15 - Jul 29');
  });

  it('formats a lone start or end date', () => {
    expect(formatDateRange('2026-07-14T22:00:00.000Z', undefined)).toBe(
      'Jul 15',
    );
    expect(formatDateRange(undefined, '2026-07-28T22:00:00.000Z')).toBe(
      'Jul 29',
    );
  });

  it('returns an empty string when both dates are missing', () => {
    expect(formatDateRange(undefined, undefined)).toBe('');
  });
});
