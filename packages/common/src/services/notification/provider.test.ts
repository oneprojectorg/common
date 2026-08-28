import { afterEach, describe, expect, it, vi } from 'vitest';

import { CommonError } from '../../utils/error';

// The real SDK constructor validates the account SID format and would reject
// the fixtures below. Only the resolver's own branching is under test here.
vi.mock('twilio', () => ({
  default: { Twilio: class {} },
}));

import { getSmsProvider } from './provider';

const ENV_KEYS = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_MESSAGING_SERVICE_SID',
  'TWILIO_VERIFY_SERVICE_SID',
] as const;

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

afterEach(() => setEnv({}));

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

  it('throws when no Messaging Service is configured', () => {
    setEnv({ TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 'token' });

    // A2P 10DLC registration attaches to a Messaging Service, so a send
    // without one would be rejected by Twilio per message.
    expect(() => getSmsProvider()).toThrow(CommonError);
  });

  it('names the missing variable so an operator can act on the message', () => {
    setEnv({ TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 'token' });

    expect(() => getSmsProvider()).toThrow(/TWILIO_MESSAGING_SERVICE_SID/);
  });

  it('omits the verification pair without a Verify service', () => {
    setEnv({
      TWILIO_ACCOUNT_SID: 'AC1',
      TWILIO_AUTH_TOKEN: 'token',
      TWILIO_MESSAGING_SERVICE_SID: 'MG1',
    });

    const provider = getSmsProvider();

    expect(provider?.sendSms).toBeDefined();
    expect(provider?.startVerification).toBeUndefined();
  });

  it('offers verification once a Verify service is configured', () => {
    setEnv({
      TWILIO_ACCOUNT_SID: 'AC1',
      TWILIO_AUTH_TOKEN: 'token',
      TWILIO_MESSAGING_SERVICE_SID: 'MG1',
      TWILIO_VERIFY_SERVICE_SID: 'VA1',
    });

    const provider = getSmsProvider();

    expect(provider?.startVerification).toBeDefined();
    expect(provider?.checkVerification).toBeDefined();
  });
});
