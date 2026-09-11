import { describe, expect, it, vi } from 'vitest';

import { CommonError } from '../../../utils/error';
import { parsePhoneNumber } from '../schemas';
import type { SmsProvider } from '../types';
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

/**
 * Builds a provider and returns one capability, failing when it is absent.
 *
 * Every capability is optional on {@link SmsProvider}, because each one follows
 * from a service the deployment configured separately. A test states which one
 * it means to exercise here, rather than asserting past the type.
 */
const capabilityOf = <K extends keyof SmsProvider>(
  options: Parameters<typeof createTwilioProvider>[0],
  name: K,
): NonNullable<SmsProvider[K]> => {
  const capability = createTwilioProvider(options)[name];
  if (!capability) {
    throw new Error(`The fixture built a provider with no ${name}.`);
  }
  return capability;
};

type MessageCreate = TwilioRestClient['messages']['create'];

/**
 * Builds a fake Twilio client from the outcome each call should produce.
 *
 * The mock signature is derived from `TwilioRestClient` itself, so the fake
 * cannot drift from the interface the adapter consumes. Stubbing the network
 * would not work here: the SDK sends over axios, so `vi.stubGlobal('fetch')`
 * never intercepts it.
 */
const fakeClient = ({
  message = async () => ({ sid: 'SM123' }),
}: {
  message?: () => Promise<{ sid: string }>;
} = {}) => {
  const messageCreate = vi.fn<MessageCreate>(message);
  const client: TwilioRestClient = { messages: { create: messageCreate } };
  return { client, messageCreate };
};

describe('createTwilioProvider', () => {
  describe('sendSms', () => {
    it('always sends through the Messaging Service, never a bare from number', async () => {
      const { client, messageCreate } = fakeClient();

      const result = await capabilityOf(
        { client, messagingServiceSid: 'MG1' },
        'sendSms',
      )({ to: TO, body: 'hello' });

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

      const result = await capabilityOf(
        { client, messagingServiceSid: 'MG1' },
        'sendSms',
      )({ to: TO, body: 'hello' });

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

        const result = await capabilityOf(
          { client, messagingServiceSid: 'MG1' },
          'sendSms',
        )({ to: TO, body: 'hi' });

        expect(result).toEqual({ status: 'rejected', reason, retryable });
      },
    );

    it('treats only throttling as retryable, so no rejection double-bills', async () => {
      const retryables = await Promise.all(
        [20429, 21610, 30034, 30007, 60410, 21211].map(async (code) => {
          const { client } = fakeClient({
            message: () => Promise.reject(restError(code)),
          });
          const result = await capabilityOf(
            { client, messagingServiceSid: 'MG1' },
            'sendSms',
          )({ to: TO, body: 'hi' });
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
        capabilityOf(
          { client, messagingServiceSid: 'MG1' },
          'sendSms',
        )({
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
        capabilityOf(
          { client, messagingServiceSid: 'MG1' },
          'sendSms',
        )({
          to: TO,
          body: 'hi',
        }),
      ).rejects.toThrow('ECONNRESET');
    });

    it('reports an unmapped Twilio code rather than throwing', async () => {
      const { client } = fakeClient({
        message: () => Promise.reject(restError(31337)),
      });

      const result = await capabilityOf(
        { client, messagingServiceSid: 'MG1' },
        'sendSms',
      )({ to: TO, body: 'hi' });

      expect(result).toEqual({
        status: 'rejected',
        reason: 'unknown',
        retryable: false,
      });
    });
  });
});
