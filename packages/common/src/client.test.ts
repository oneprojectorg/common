import { describe, expect, it } from 'vitest';

import { hasEmail } from './client';

describe('hasEmail', () => {
  it('returns true for a non-empty email', () => {
    expect(hasEmail({ email: 'ada@example.com' })).toBe(true);
  });

  it('returns true for an empty string (presence guard, not a validity check)', () => {
    // hasEmail only narrows away null/undefined; it does not validate format,
    // so '' is considered present.
    expect(hasEmail({ email: '' })).toBe(true);
  });

  it('returns false for a null email', () => {
    expect(hasEmail({ email: null })).toBe(false);
  });

  it('returns false for an undefined email', () => {
    expect(hasEmail({ email: undefined })).toBe(false);
  });

  it('returns false when the email property is absent', () => {
    expect(hasEmail({})).toBe(false);
  });

  it('preserves the rest of the row when used as a filter', () => {
    const rows = [
      { id: '1', email: 'ada@example.com' },
      { id: '2', email: null },
      { id: '3', email: undefined },
      { id: '4', email: 'grace@example.com' },
    ];

    const withEmail = rows.filter(hasEmail);

    // Narrowed to a non-null string, so .toLowerCase() needs no guard.
    expect(withEmail.map((r) => r.email.toLowerCase())).toEqual([
      'ada@example.com',
      'grace@example.com',
    ]);
    expect(withEmail.map((r) => r.id)).toEqual(['1', '4']);
  });
});
