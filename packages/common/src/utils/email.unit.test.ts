import { describe, expect, it } from 'vitest';

import { hasEmail, selectEmailRecipients } from './email';

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

  it('preserves the rest of the rows when used as a filter', () => {
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

describe('selectEmailRecipients', () => {
  it('drops rows with no usable email', () => {
    expect(
      selectEmailRecipients([
        { email: 'ada@example.com' },
        { email: null },
        { email: undefined },
        { email: '' },
        { email: 'grace@example.com' },
      ]),
    ).toEqual(['ada@example.com', 'grace@example.com']);
  });

  it('collapses addresses that differ only in case', () => {
    expect(
      selectEmailRecipients([
        { email: 'Ada@Example.com' },
        { email: 'ada@example.com' },
        { email: 'ADA@EXAMPLE.COM' },
      ]),
    ).toEqual(['Ada@Example.com']);
  });

  it('keeps the first occurrence with its original casing', () => {
    expect(
      selectEmailRecipients([
        { email: 'Grace.Hopper@Example.com' },
        { email: 'grace.hopper@example.com' },
      ]),
    ).toEqual(['Grace.Hopper@Example.com']);
  });

  it('returns an empty list when no row has an address', () => {
    expect(selectEmailRecipients([{ email: null }, {}])).toEqual([]);
  });
});
