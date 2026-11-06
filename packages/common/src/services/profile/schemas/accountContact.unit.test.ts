import { describe, expect, it } from 'vitest';

import { toAccountContact } from './accountContact';

describe('toAccountContact', () => {
  it('prefers the email when the account has both', () => {
    expect(
      toAccountContact({ email: 'ada@example.org', phone: '15005550007' }),
    ).toEqual({ type: 'email', email: 'ada@example.org' });
  });

  it('falls back to the phone with a leading +', () => {
    expect(toAccountContact({ email: null, phone: '15005550007' })).toEqual({
      type: 'phone',
      phone: '+15005550007',
    });
  });

  it('treats empty strings as missing', () => {
    expect(toAccountContact({ email: '', phone: '15005550007' })).toEqual({
      type: 'phone',
      phone: '+15005550007',
    });
    expect(toAccountContact({ email: '', phone: '' })).toBeNull();
  });

  it('returns null when both are null', () => {
    expect(toAccountContact({ email: null, phone: null })).toBeNull();
  });

  it('returns null when the profile has no owning account', () => {
    expect(toAccountContact(null)).toBeNull();
    expect(toAccountContact(undefined)).toBeNull();
  });
});
