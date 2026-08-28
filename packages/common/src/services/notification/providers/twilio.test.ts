import { describe, expect, it, vi } from 'vitest';

import { CommonError } from '../../../utils/error';
import { parsePhoneNumber } from '../schemas';
import { type TwilioRestClient, createTwilioProvider } from './twilio';

/** Twilio's own magic test number, so no real line appears in a fixture. */
const TO = parsePhoneNumber('+15005550006');

/**
 * Builds a Twilio `RestException` as the adapter reads it.
 *
 * The adapter identifies a Twilio failure structurally, by a numeric `code` or
 * `status`, so a plain `Error` carrying those two properties exercises the same
 * path a real exception does.
 *
 * @param code - The Twilio error code, such as `21610`.
 * @param status - The HTTP status. Pass `404` to model an expired verification.
 */
const restError = (code: number, status = 400) =>
  Object.assign(new Error(`Twilio error ${code}`), { code, status });

type Services = TwilioRestClient['verify']['v2']['services'];
type MessageCreate = TwilioRestClient['messages']['create'];
type VerificationCreate = ReturnType<Services>['verifications']['create'];
type CheckCreate = ReturnType<Services>['verificationChecks']['create'];

/**
 * Builds a fake Twilio client from the outcome each call should produce.
 *
 * The mock signatures are derived from `TwilioRestClient` itself, so the fake
 * cannot drift from the interface the adapter consumes. Stubbing the network
 * would not work here: the SDK sends over axios, so `vi.stubGlobal('fetch')`
 * never intercepts it.
 */
const fakeClient = ({
  message = async () => ({ sid: 'SM123' }),
  verification = async () => ({ status: 'pending' }),
  check = async () => ({ status: 'approved' }),
}: {
  message?: () => Promise<{ sid: string }>;
  verification?: () => Promise<{ status: string }>;
  check?: () => Promise<{ status: string }>;
} = {}) => {
  const messageCreate = vi.fn<MessageCreate>(message);
  const verificationCreate = vi.fn<VerificationCreate>(verification);
  const checkCreate = vi.fn<CheckCreate>(check);
  const services = vi.fn<Services>(() => ({
    verifications: { create: verificationCreate },
    verificationChecks: { create: checkCreate },
  }));
  const client: TwilioRestClient = {
    messages: { create: messageCreate },
    verify: { v2: { services } },
  };
  return { client, messageCreate, verificationCreate, checkCreate, services };
};

describe('createTwilioProvider', () => {
  describe('sendSms', () => {
    it('always sends through the Messaging Service, never a bare from number', async () => {
      const { client, messageCreate } = fakeClient();

      const result = await createTwilioProvider({
        client,
        messagingServiceSid: 'MG1',
      }).sendSms({ to: TO, body: 'hello' });

      expect(messageCreate).toHaveBeenCalledWith({
        to: '+15005550006',
        body: 'hello',
        messagingServiceSid: 'MG1',
      });
      // A bare `from` would bypass A2P 10DLC registration and sticky sender.
      expect(messageCreate.mock.calls[0]?.[0]).not.toHaveProperty('from');
      expect(result).toEqual({
        status: 'accepted',
        providerMessageId: 'SM123',
      });
    });

    it('reports acceptance, not delivery', async () => {
      const { client } = fakeClient();

      const result = await createTwilioProvider({
        client,
        messagingServiceSid: 'MG1',
      }).sendSms({ to: TO, body: 'hello' });

      // Delivery is only ever known from the status callback, so no status
      // this method can return may claim it.
      expect(result.status).toBe('accepted');
    });

    it.each([
      [20429, 'rate_limited', true],
      [21610, 'opted_out', false],
      [30034, 'unregistered_sender', false],
      [30007, 'carrier_filtered', false],
      [60410, 'blocked_fraud', false],
      [21211, 'invalid_number', false],
    ] as const)(
      'maps Twilio %i to %s (retryable: %s)',
      async (code, reason, retryable) => {
        const { client } = fakeClient({
          message: () => Promise.reject(restError(code)),
        });

        const result = await createTwilioProvider({
          client,
          messagingServiceSid: 'MG1',
        }).sendSms({ to: TO, body: 'hi' });

        expect(result).toEqual({ status: 'rejected', reason, retryable });
      },
    );

    it('treats only throttling as retryable, so no rejection double-bills', async () => {
      const retryables = await Promise.all(
        [20429, 21610, 30034, 30007, 60410, 21211].map(async (code) => {
          const { client } = fakeClient({
            message: () => Promise.reject(restError(code)),
          });
          const result = await createTwilioProvider({
            client,
            messagingServiceSid: 'MG1',
          }).sendSms({ to: TO, body: 'hi' });
          return result.status === 'rejected' && result.retryable ? code : null;
        }),
      );

      expect(retryables.filter(Boolean)).toEqual([20429]);
    });

    it('rethrows a credential failure instead of reporting it per message', async () => {
      const { client } = fakeClient({
        message: () => Promise.reject(restError(20003, 401)),
      });

      // A bad auth token is an operator mistake. Reporting it as a rejection
      // would make it look like the participant refused delivery.
      await expect(
        createTwilioProvider({ client, messagingServiceSid: 'MG1' }).sendSms({
          to: TO,
          body: 'hi',
        }),
      ).rejects.toThrow(CommonError);
    });

    it('rethrows a network error rather than flattening it to unknown', async () => {
      const { client } = fakeClient({
        message: () => Promise.reject(new Error('ECONNRESET')),
      });

      await expect(
        createTwilioProvider({ client, messagingServiceSid: 'MG1' }).sendSms({
          to: TO,
          body: 'hi',
        }),
      ).rejects.toThrow('ECONNRESET');
    });

    it('reports an unmapped Twilio code rather than throwing', async () => {
      const { client } = fakeClient({
        message: () => Promise.reject(restError(31337)),
      });

      const result = await createTwilioProvider({
        client,
        messagingServiceSid: 'MG1',
      }).sendSms({ to: TO, body: 'hi' });

      expect(result).toEqual({
        status: 'rejected',
        reason: 'unknown',
        retryable: false,
      });
    });
  });

  describe('verification', () => {
    it('omits the verification pair when no Verify service is configured', () => {
      const { client } = fakeClient();

      const provider = createTwilioProvider({
        client,
        messagingServiceSid: 'MG1',
      });

      expect(provider.startVerification).toBeUndefined();
      expect(provider.checkVerification).toBeUndefined();
      expect(provider.sendSms).toBeDefined();
    });

    it('starts an SMS verification against the configured service', async () => {
      const { client, verificationCreate, services } = fakeClient();

      const result = await createTwilioProvider({
        client,
        messagingServiceSid: 'MG1',
        verifyServiceSid: 'VA1',
      }).startVerification!({ to: TO, locale: 'ar' });

      expect(services).toHaveBeenCalledWith('VA1');
      expect(verificationCreate).toHaveBeenCalledWith({
        to: '+15005550006',
        channel: 'sms',
        locale: 'ar',
      });
      expect(result).toEqual({ status: 'pending' });
    });

    it('omits locale entirely when the caller gives none', async () => {
      const { client, verificationCreate } = fakeClient();

      await createTwilioProvider({
        client,
        messagingServiceSid: 'MG1',
        verifyServiceSid: 'VA1',
      }).startVerification!({ to: TO });

      // Sending `locale: undefined` would override Twilio's own
      // country-code-based resolution with nothing.
      expect(verificationCreate.mock.calls[0]?.[0]).not.toHaveProperty(
        'locale',
      );
    });

    it('approves only an approved check', async () => {
      const { client } = fakeClient({
        check: async () => ({ status: 'approved' }),
      });

      await expect(
        createTwilioProvider({
          client,
          messagingServiceSid: 'MG1',
          verifyServiceSid: 'VA1',
        }).checkVerification!({ to: TO, code: '123456' }),
      ).resolves.toEqual({ status: 'approved' });
    });

    it.each(['pending', 'canceled'])(
      'treats a %s check as a wrong code',
      async (status) => {
        const { client } = fakeClient({
          check: async () => ({ status }),
        });

        await expect(
          createTwilioProvider({
            client,
            messagingServiceSid: 'MG1',
            verifyServiceSid: 'VA1',
          }).checkVerification!({ to: TO, code: '000000' }),
        ).resolves.toEqual({ status: 'rejected' });
      },
    );

    it('reads a 404 as expired rather than as a wrong code', async () => {
      const { client } = fakeClient({
        check: () => Promise.reject(restError(20404, 404)),
      });

      // Telling a participant their code was wrong, when the verification had
      // expired, sends them back to retyping a code that can never work.
      await expect(
        createTwilioProvider({
          client,
          messagingServiceSid: 'MG1',
          verifyServiceSid: 'VA1',
        }).checkVerification!({ to: TO, code: '123456' }),
      ).resolves.toEqual({ status: 'expired' });
    });
  });
});
