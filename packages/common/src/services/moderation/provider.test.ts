import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getModerationProvider } from './provider';

// Snapshot/restore the env keys the registry reads.
const ENV_KEYS = [
  'MODERATION_PROVIDER',
  'MODERATION_API_KEY',
  'MODERATION_POLICY_MAP',
  'MODERATION_DETACH_POLICIES',
];
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
    // Optional on the interface and called with `?.()`, so dropping it here
    // would typecheck and silently stop raising cases. Asserts the wiring.
    expect(provider!.reportForReview).toBeInstanceOf(Function);
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

  it('throws on an invalid MODERATION_POLICY_MAP (fails loudly at startup)', () => {
    process.env.MODERATION_API_KEY = 'k';
    // Bad category value — not one of the seven ModerationCategory members.
    process.env.MODERATION_POLICY_MAP = JSON.stringify({ HTE: 'not-a-cat' });
    expect(() => getModerationProvider()).toThrow(/MODERATION_POLICY_MAP/);
  });

  it('names the env var on malformed MODERATION_POLICY_MAP JSON (not a raw SyntaxError)', () => {
    process.env.MODERATION_API_KEY = 'k';
    process.env.MODERATION_POLICY_MAP = '{not json';
    expect(() => getModerationProvider()).toThrow(
      /MODERATION_POLICY_MAP.*malformed JSON/,
    );
  });

  it('accepts a well-formed MODERATION_POLICY_MAP + MODERATION_DETACH_POLICIES', () => {
    process.env.MODERATION_API_KEY = 'k';
    process.env.MODERATION_POLICY_MAP = JSON.stringify({
      VLC: 'violence',
      CSE: 'csam',
    });
    process.env.MODERATION_DETACH_POLICIES = 'CSE, CHILD_ABUSE';
    // Wired through to the factory without throwing.
    expect(getModerationProvider()).not.toBeNull();
  });
});
