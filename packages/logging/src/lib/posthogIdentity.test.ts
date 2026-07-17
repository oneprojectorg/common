import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getPosthogCookieName,
  getPosthogDistinctIdFromCookieHeader,
  parsePosthogDistinctId,
} from './posthogIdentity';

const KEY = 'phc_test_key';

describe('getPosthogCookieName', () => {
  const original = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  afterEach(() => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = original;
  });

  it('builds the cookie name from the project key', () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = KEY;
    expect(getPosthogCookieName()).toBe(`ph_${KEY}_posthog`);
  });

  it('returns undefined when the key is unset', () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    expect(getPosthogCookieName()).toBeUndefined();
  });
});

describe('parsePosthogDistinctId', () => {
  it('extracts distinct_id from the persisted JSON', () => {
    const value = JSON.stringify({ distinct_id: 'user-123', other: 1 });
    expect(parsePosthogDistinctId(value)).toBe('user-123');
  });

  it('returns undefined for empty, malformed, or non-matching values', () => {
    expect(parsePosthogDistinctId(undefined)).toBeUndefined();
    expect(parsePosthogDistinctId(null)).toBeUndefined();
    expect(parsePosthogDistinctId('')).toBeUndefined();
    expect(parsePosthogDistinctId('not json')).toBeUndefined();
    expect(
      parsePosthogDistinctId(JSON.stringify({ foo: 'bar' })),
    ).toBeUndefined();
    expect(
      parsePosthogDistinctId(JSON.stringify({ distinct_id: 42 })),
    ).toBeUndefined();
  });
});

describe('getPosthogDistinctIdFromCookieHeader', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = KEY;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  });

  it('finds and URL-decodes the PostHog cookie among others', () => {
    const cookieValue = encodeURIComponent(
      JSON.stringify({ distinct_id: 'anon-abc' }),
    );
    const header = `foo=1; ph_${KEY}_posthog=${cookieValue}; bar=2`;
    expect(getPosthogDistinctIdFromCookieHeader(header)).toBe('anon-abc');
  });

  it('returns undefined when the cookie or key is absent', () => {
    expect(
      getPosthogDistinctIdFromCookieHeader('foo=1; bar=2'),
    ).toBeUndefined();
    expect(getPosthogDistinctIdFromCookieHeader(undefined)).toBeUndefined();
    expect(getPosthogDistinctIdFromCookieHeader('')).toBeUndefined();
  });
});
