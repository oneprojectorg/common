import { describe, expect, it } from 'vitest';

import { hasEmail } from './client';

describe('hasEmail', () => {
  it('returns true for a non-empty email', () => {
    expect(hasEmail({ email: 'ada@example.com' })).toBe(true);
  });

  it('returns false for an empty string (treated as absent, not format-validated)', () => {
    // An empty email is unusable everywhere it's consumed, so it counts as
    // absent — without validating that a non-empty value is a real address.
    expect(hasEmail({ email: '' })).toBe(false);
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
