import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildModerationProvider } from './provider';

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

describe('buildModerationProvider', () => {
  it('returns null when MODERATION_PROVIDER is unset (feature off)', () => {
    expect(buildModerationProvider()).toBeNull();
  });

  it('returns null when the selected vendor has no API key', () => {
    process.env.MODERATION_PROVIDER = 'hive';
    expect(buildModerationProvider()).toBeNull();
  });

  it('builds a hive provider (pure classifier, no submitForReview)', () => {
    process.env.MODERATION_PROVIDER = 'hive';
    process.env.MODERATION_API_KEY = 'k';
    const provider = buildModerationProvider();
    expect(provider).not.toBeNull();
    expect(provider!.submitForReview).toBeUndefined();
  });

  it('builds a lasso provider with submitForReview', () => {
    process.env.MODERATION_PROVIDER = 'lasso';
    process.env.MODERATION_API_KEY = 'k';
    const provider = buildModerationProvider();
    expect(provider!.submitForReview).toBeInstanceOf(Function);
  });

  it('builds a checkstep provider with submitForReview', () => {
    process.env.MODERATION_PROVIDER = 'checkstep';
    process.env.MODERATION_API_KEY = 'k';
    const provider = buildModerationProvider();
    expect(provider!.submitForReview).toBeInstanceOf(Function);
  });

  it('throws a clear error on an unknown provider value', () => {
    process.env.MODERATION_PROVIDER = 'bogus';
    process.env.MODERATION_API_KEY = 'k';
    expect(() => buildModerationProvider()).toThrow(/bogus/);
  });
});
