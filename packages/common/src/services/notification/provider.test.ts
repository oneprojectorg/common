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

  it('sends but does not verify with only a Messaging Service', () => {
    setEnv({
      TWILIO_ACCOUNT_SID: 'AC1',
      TWILIO_AUTH_TOKEN: 'token',
      TWILIO_MESSAGING_SERVICE_SID: 'MG1',
    });

    const provider = getSmsProvider();

    expect(provider?.sendSms).toBeDefined();
    expect(provider?.startVerification).toBeUndefined();
    expect(provider?.checkVerification).toBeUndefined();
  });

  it('verifies but does not send with only a Verify service', () => {
    setEnv({
      TWILIO_ACCOUNT_SID: 'AC1',
      TWILIO_AUTH_TOKEN: 'token',
      TWILIO_VERIFY_SERVICE_SID: 'VA1',
    });

    const provider = getSmsProvider();

    // This is the phase-1 shape. Twilio exempts Verify traffic from A2P 10DLC,
    // so signup works weeks before a Messaging Service campaign is approved.
    expect(provider?.startVerification).toBeDefined();
    expect(provider?.checkVerification).toBeDefined();
    expect(provider?.sendSms).toBeUndefined();
  });

  it('offers every capability with both services', () => {
    setEnv({
      TWILIO_ACCOUNT_SID: 'AC1',
      TWILIO_AUTH_TOKEN: 'token',
      TWILIO_MESSAGING_SERVICE_SID: 'MG1',
      TWILIO_VERIFY_SERVICE_SID: 'VA1',
    });

    const provider = getSmsProvider();

    expect(provider?.sendSms).toBeDefined();
    expect(provider?.startVerification).toBeDefined();
    expect(provider?.checkVerification).toBeDefined();
  });
});
