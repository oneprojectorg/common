import { describe, expect, it } from 'vitest';

import { zodUrl, zodUrlRefine } from './validation';

describe('zodUrlRefine', () => {
  it('accepts a bare domain without a protocol', () => {
    expect(zodUrlRefine('venuecms.com')).toBe(true);
  });

  it('accepts a domain with a protocol', () => {
    expect(zodUrlRefine('https://venuecms.com')).toBe(true);
  });
});

describe('zodUrl (required)', () => {
  const schema = zodUrl({
    isRequired: true,
    error: 'Enter a valid website address',
  });

  it('accepts a bare domain (auto-prefixed to https://)', () => {
    const result = schema.safeParse('venuecms.com');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('https://venuecms.com');
    }
  });

  it('accepts a domain that already has a protocol', () => {
    const result = schema.safeParse('https://venuecms.com');
    expect(result.success).toBe(true);
  });
});

// Root cause of the org-create-form bug: our schema intentionally accepts a
// bare domain and auto-prefixes `https://`, but an `<input type="url">` uses the
// browser's *native* URL constraint (mirrored by `new URL(...)`), which rejects
// a scheme-less value. React Aria defaults to `validationBehavior="native"`, so
// that native mismatch silently blocked form submission — the value never
// reached this (lenient) schema. The field must therefore let this schema be the
// source of truth (validationBehavior="aria") rather than native URL validation.
describe('bare domain vs. native <input type="url"> validation', () => {
  const isNativeUrlValid = (val: string) => {
    try {
      // eslint-disable-next-line no-new
      new URL(val);
      return true;
    } catch {
      return false;
    }
  };

  it('native URL validation rejects a bare domain that our schema accepts', () => {
    const schema = zodUrl({
      isRequired: true,
      error: 'Enter a valid website address',
    });

    // The exact reported reproduction: bare domain fails native validation...
    expect(isNativeUrlValid('venuecms.com')).toBe(false);
    // ...even though our schema (the intended source of truth) accepts it.
    expect(schema.safeParse('venuecms.com').success).toBe(true);

    // Adding a scheme satisfies both, which is why the workaround worked.
    expect(isNativeUrlValid('https://venuecms.com')).toBe(true);
    expect(schema.safeParse('https://venuecms.com').success).toBe(true);
  });
});
