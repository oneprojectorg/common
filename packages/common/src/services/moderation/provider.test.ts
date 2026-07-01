import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getModerationProvider } from './provider';

// Snapshot/restore the env keys the registry reads.
const ENV_KEYS = ['MODERATION_PROVIDER', 'MODERATION_API_KEY'];
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
});

describe('getModerationProvider', () => {
  it('returns null when no API key is configured (feature off)', () => {
    expect(getModerationProvider()).toBeNull();
  });

  it('builds a checkstep provider with the async review contract', () => {
    process.env.MODERATION_API_KEY = 'k';
    const provider = getModerationProvider();
    expect(provider).not.toBeNull();
    expect(provider!.submitForReview).toBeInstanceOf(Function);
    expect(provider!.parseWebhook).toBeInstanceOf(Function);
  });

  it('accepts MODERATION_PROVIDER=checkstep as an explicit no-op', () => {
    process.env.MODERATION_PROVIDER = 'checkstep';
    process.env.MODERATION_API_KEY = 'k';
    expect(getModerationProvider()).not.toBeNull();
  });

  it('throws when MODERATION_PROVIDER names any other vendor', () => {
    process.env.MODERATION_PROVIDER = 'bogus';
    process.env.MODERATION_API_KEY = 'k';
    expect(() => getModerationProvider()).toThrow(/bogus/);
  });
});
