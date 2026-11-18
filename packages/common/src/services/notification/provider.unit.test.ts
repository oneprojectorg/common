import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CommonError } from '../../utils/error';
import { parsePhoneNumber } from './schemas';

// The real SDK constructor validates the account SID format and would reject
// the fixtures below. Only the resolver's own branching is under test here.
vi.mock('twilio', () => ({
  default: { Twilio: class {} },
}));

import { getSmsProvider } from './provider';

const ENV_KEYS = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_API_KEY_SID',
  'TWILIO_API_KEY_SECRET',
  'TWILIO_MESSAGING_SERVICE_SID',
  'TWILIO_VERIFY_SERVICE_SID',
  'TWILIO_FAKE_SMS_OUTBOX',
] as const;

/** A well-formed account, so a test varies only what it is about. */
const ACCOUNT = {
  TWILIO_ACCOUNT_SID: 'AC1',
  TWILIO_AUTH_TOKEN: 'token',
  TWILIO_VERIFY_SERVICE_SID: 'VA1',
} as const;

/** Sets exactly the given variables, and clears the rest. */
const setEnv = (values: Partial<Record<(typeof ENV_KEYS)[number], string>>) => {
  for (const key of ENV_KEYS) {
    const value = values[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

afterEach(() => {
  setEnv({});
});

describe('getSmsProvider', () => {
  it('returns null when no account is configured', () => {
    setEnv({});

    // SMS is off, not broken. A checkout with no Twilio account must boot.
    expect(getSmsProvider()).toBeNull();
  });

  it('throws when the account SID is set without an auth token', () => {
    setEnv({
      TWILIO_ACCOUNT_SID: 'AC1',
      TWILIO_MESSAGING_SERVICE_SID: 'MG1',
    });

    // Half-set credentials are an operator mistake. Turning SMS off silently
    // would hide it until a participant failed to receive a code.
    expect(() => getSmsProvider()).toThrow(CommonError);
  });

  it('throws when the account has no service at all', () => {
    setEnv({ TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 'token' });

    // An account with neither service can do nothing. Returning a provider
    // with no methods would push the failure to the first caller.
    expect(() => getSmsProvider()).toThrow(CommonError);
  });

  it('names both service variables so an operator can act on the message', () => {
    setEnv({ TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 'token' });

    expect(() => getSmsProvider()).toThrow(/TWILIO_MESSAGING_SERVICE_SID/);
    expect(() => getSmsProvider()).toThrow(/TWILIO_VERIFY_SERVICE_SID/);
  });

  it('sends with only a Messaging Service', () => {
    setEnv({
      TWILIO_ACCOUNT_SID: 'AC1',
      TWILIO_AUTH_TOKEN: 'token',
      TWILIO_MESSAGING_SERVICE_SID: 'MG1',
    });

    const provider = getSmsProvider();

    expect(provider?.sendSms).toBeDefined();
  });

  it('carries no method with only a Verify service', () => {
    setEnv({
      TWILIO_ACCOUNT_SID: 'AC1',
      TWILIO_AUTH_TOKEN: 'token',
      TWILIO_VERIFY_SERVICE_SID: 'VA1',
    });

    const provider = getSmsProvider();

    // This is the phase-1 shape. GoTrue reads TWILIO_VERIFY_SERVICE_SID and
    // confirms numbers itself, so this provider carries no method at all.
    expect(provider?.sendSms).toBeUndefined();
  });

  it('sends with both services', () => {
    setEnv({
      TWILIO_ACCOUNT_SID: 'AC1',
      TWILIO_AUTH_TOKEN: 'token',
      TWILIO_MESSAGING_SERVICE_SID: 'MG1',
      TWILIO_VERIFY_SERVICE_SID: 'VA1',
    });

    const provider = getSmsProvider();

    expect(provider?.sendSms).toBeDefined();
  });

  describe('credentials', () => {
    it('accepts an API key pair instead of the account token', () => {
      setEnv({
        TWILIO_ACCOUNT_SID: 'AC1',
        TWILIO_API_KEY_SID: 'SK1',
        TWILIO_API_KEY_SECRET: 'secret',
        TWILIO_VERIFY_SERVICE_SID: 'VA1',
      });

      // A key is scoped and revocable on its own, unlike the account token.
      expect(getSmsProvider()).not.toBeNull();
    });

    it('throws when an API key has no secret', () => {
      setEnv({ ...ACCOUNT, TWILIO_API_KEY_SID: 'SK1' });

      expect(() => getSmsProvider()).toThrow(/TWILIO_API_KEY_SECRET/);
    });

    it('throws when no credential of either kind is set', () => {
      setEnv({ TWILIO_ACCOUNT_SID: 'AC1', TWILIO_VERIFY_SERVICE_SID: 'VA1' });

      expect(() => getSmsProvider()).toThrow(CommonError);
    });
  });

  describe('fake outbox', () => {
    it('writes each send to the outbox file instead of a vendor', async () => {
      const path = join(tmpdir(), `sms-outbox-${randomUUID()}.jsonl`);
      setEnv({ TWILIO_FAKE_SMS_OUTBOX: path });

      const provider = getSmsProvider();
      const result = await provider?.sendSms?.({
        to: parsePhoneNumber('+15005550006'),
        body: 'hello there',
      });

      expect(result?.status).toBe('accepted');
      const lines = (await readFile(path, 'utf8')).trim().split('\n');
      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0]!)).toMatchObject({
        to: '+15005550006',
        from: null,
        body: 'hello there',
      });
      await rm(path);
    });

    it('wins over real credentials', async () => {
      const path = join(tmpdir(), `sms-outbox-${randomUUID()}.jsonl`);
      setEnv({
        ...ACCOUNT,
        TWILIO_MESSAGING_SERVICE_SID: 'MG1',
        TWILIO_FAKE_SMS_OUTBOX: path,
      });

      const provider = getSmsProvider();
      const result = await provider?.sendSms?.({
        to: parsePhoneNumber('+15005550006'),
        body: 'hi',
      });

      expect(result?.status).toBe('accepted');
      expect(result?.status === 'accepted' && result.providerMessageId).toMatch(
        /^fake-/,
      );
      await rm(path);
    });

    it('is refused in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      setEnv({ TWILIO_FAKE_SMS_OUTBOX: '/tmp/never-written.jsonl' });

      expect(() => getSmsProvider()).toThrow(CommonError);

      vi.unstubAllEnvs();
    });
  });
});
