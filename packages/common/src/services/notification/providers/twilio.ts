import { logger } from '@op/logging';

import { CommonError } from '../../../utils/error';
import type {
  PhoneNumber,
  SmsFailureReason,
  SmsProvider,
  SmsSendResult,
  VerificationCheck,
  VerificationStart,
} from '../types';

/**
 * The Twilio SDK surface that {@link createTwilioProvider} calls.
 *
 * Use this type to supply the adapter its Twilio client. It is the adapter's
 * dependency, and it is deliberately Twilio-shaped. Do not mistake it for our
 * vendor-neutral contract: that is {@link SmsProvider}, which names no vendor
 * and is what the rest of the application uses.
 *
 * Two callers supply a value. {@link getSmsProvider} passes a real `Twilio`
 * instance. That assignment is what proves this type still matches the SDK,
 * because a shape change in `twilio` fails `tsc` there. A test passes a small
 * fake, so no test needs credentials, a network stub, or a module mock.
 *
 * Declare each property the adapter calls, and no more. A wider type makes
 * every fake grow with it, and buys nothing.
 *
 * @example Production, from `getSmsProvider`
 * ```ts
 * createTwilioProvider({
 *   client: new twilio.Twilio(accountSid, authToken),
 *   messagingServiceSid,
 * });
 * ```
 *
 * @example A test, with a fake that records the call
 * ```ts
 * const create = vi.fn(async () => ({ sid: 'SM1' }));
 * const client = { messages: { create }, verify: fakeVerify() };
 * createTwilioProvider({ client, messagingServiceSid: 'MG1' });
 * ```
 *
 * @interface
 * @see {@link https://www.twilio.com/docs/messaging/api/message-resource}
 * @see {@link https://www.twilio.com/docs/verify/api/verification}
 */
export interface TwilioRestClient {
  /** Twilio's Message resource, which sends an SMS. */
  messages: {
    /**
     * Queues one outbound SMS.
     *
     * @param options.to - The recipient, in E.164 format.
     * @param options.body - The message text.
     * @param options.messagingServiceSid - The Messaging Service to send
     *   through. Required, because A2P 10DLC registration applies to a
     *   Messaging Service rather than to a bare number.
     * @returns The queued message. Its `sid` identifies the message on the
     *   later status callback. A returned `sid` reports acceptance, not
     *   delivery.
     */
    create(options: {
      to: string;
      body: string;
      messagingServiceSid: string;
    }): Promise<{ sid: string }>;
  };

  /** Twilio's Verify API, which owns the code and checks it for us. */
  verify: {
    v2: {
      /**
       * Selects one Verify service.
       *
       * @param serviceSid - The `VA...` service to verify against.
       */
      services(serviceSid: string): {
        verifications: {
          /**
           * Generates a code and sends it to `to`.
           *
           * @param options.channel - The delivery channel. The adapter always
           *   sends `sms`.
           * @param options.locale - The language of the code's message. Twilio
           *   resolves a locale from the country code when this is absent, so
           *   the adapter omits the property rather than passing `undefined`.
           * @returns The verification. Its `status` reads `pending`.
           */
          create(options: {
            to: string;
            channel: string;
            locale?: string;
          }): Promise<{ status: string }>;
        };
        verificationChecks: {
          /**
           * Checks a code against the pending verification for `to`.
           *
           * @returns The check. Its `status` reads `approved` for a correct
           *   code, and `pending` or `canceled` for an incorrect one. The call
           *   throws a 404 when the verification expired.
           */
          create(options: {
            to: string;
            code: string;
          }): Promise<{ status: string }>;
        };
      };
    };
  };
}

/**
 * Maps each Twilio error code the adapter understands to one of our own
 * reasons.
 *
 * Add an entry here to teach the adapter a new code. Do not read a code
 * anywhere else: this table is the only place a Twilio number appears, which
 * is what keeps {@link SmsFailureReason} free of vendor vocabulary.
 *
 * Twilio publishes no "retryable" column, so we decide retryability here,
 * once. Only 20429 is safe to repeat, because Twilio documents a throttled
 * request as unprocessed and safe to retry after a backoff. Every other entry
 * describes a message that fails the same way on a second attempt. Repeating
 * one costs money and changes nothing.
 *
 * @see https://www.twilio.com/docs/api/errors/20429
 */
const FAILURE_BY_CODE: Readonly<
  Record<number, { reason: SmsFailureReason; retryable: boolean }>
> = {
  20429: { reason: 'rate_limited', retryable: true },
  21211: { reason: 'invalid_number', retryable: false },
  21610: { reason: 'opted_out', retryable: false },
  30007: { reason: 'carrier_filtered', retryable: false },
  30032: { reason: 'unregistered_sender', retryable: false },
  30034: { reason: 'unregistered_sender', retryable: false },
  60200: { reason: 'invalid_number', retryable: false },
  60203: { reason: 'rate_limited', retryable: false },
  60410: { reason: 'blocked_fraud', retryable: false },
};

/**
 * Codes that report a misconfigured deployment rather than one failed message.
 *
 * {@link toRejection} rethrows these so an operator sees them. Reporting a bad
 * credential as a per-message rejection would make one wrong environment
 * variable look like every participant refusing delivery.
 */
const CONFIGURATION_ERROR_CODES = new Set([20003, 20404]);

/**
 * Reads the code and HTTP status off a thrown Twilio `RestException`.
 *
 * Twilio's exception class is not imported, because importing it would pull the
 * SDK into this module's type surface for one property read. The check is
 * structural instead.
 *
 * @param error - Any thrown value, including one that is not an object.
 * @returns The code and status when the value carries either, and `null` when
 *   it carries neither. A `null` result means the failure did not come from
 *   Twilio, so the caller rethrows it.
 */
const asRestError = (
  error: unknown,
): { code?: number; status?: number } | null => {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const code = numericProperty(error, 'code');
  const status = numericProperty(error, 'status');
  if (code === undefined && status === undefined) {
    return null;
  }
  return { code, status };
};

/**
 * Reads one numeric property off an object of unknown shape.
 *
 * `Reflect.get` keeps the read honest: the result is typed `unknown` and is
 * narrowed by the check, so no cast claims a shape the value may not have.
 *
 * @returns The value when it is a number, and `undefined` otherwise.
 */
const numericProperty = (value: object, key: string): number | undefined => {
  const raw: unknown = Reflect.get(value, key);
  return typeof raw === 'number' ? raw : undefined;
};

/**
 * Turns a thrown Twilio error into the rejection half of an
 * {@link SmsSendResult}.
 *
 * Call this from a `catch` block around a Twilio call. It answers only for a
 * failure that belongs to one message. Anything else it rethrows, so a real
 * fault fails loudly instead of reaching a caller flattened into `unknown`.
 *
 * @param error - The value the Twilio call threw.
 * @param operation - The adapter method that failed, recorded on the warning
 *   an unmapped code emits.
 * @returns Our reason for the failure, and whether a retry can succeed.
 * @throws The original error when Twilio did not raise it, such as a socket
 *   failure.
 * @throws {CommonError} When Twilio rejected our credentials. See
 *   {@link CONFIGURATION_ERROR_CODES}.
 */
const toRejection = (
  error: unknown,
  operation: string,
): { reason: SmsFailureReason; retryable: boolean } => {
  const rest = asRestError(error);
  if (!rest?.code) {
    throw error;
  }
  if (CONFIGURATION_ERROR_CODES.has(rest.code)) {
    throw new CommonError(
      `Twilio rejected our credentials (code ${rest.code}). Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.`,
    );
  }
  const known = FAILURE_BY_CODE[rest.code];
  if (known) {
    return known;
  }
  // An unmapped code is still a real answer from Twilio about this message, so
  // it is reported rather than thrown. Logged so the table above can grow.
  logger.warn('Unmapped Twilio error code', { code: rest.code, operation });
  return { reason: 'unknown', retryable: false };
};

/**
 * Builds the Twilio-backed {@link SmsProvider}.
 *
 * Call this to obtain an SMS provider in a test, where you supply a fake
 * client. In production call `getSmsProvider` instead, which reads the
 * environment and calls this function for you.
 *
 * The returned provider speaks only our vocabulary. A caller never sees a
 * Twilio error code, a SID, or an exception from the SDK.
 *
 * @param options.client - The Twilio client to call. See
 *   {@link TwilioRestClient}.
 * @param options.messagingServiceSid - The `MG...` Messaging Service every
 *   send goes through. A2P 10DLC requires one, and sticky sender and geomatch
 *   are Messaging Service features, so the adapter never sends from a bare
 *   number.
 * @param options.verifyServiceSid - The `VA...` Verify service. Omit it and
 *   the returned provider omits `startVerification` and `checkVerification`,
 *   so a deployment that only sends notifications needs no Verify service.
 * @returns A provider whose `sendSms` is always present, and whose
 *   verification pair is present only with `verifyServiceSid`.
 *
 * @example Send one message
 * ```ts
 * const provider = createTwilioProvider({ client, messagingServiceSid });
 * const result = await provider.sendSms({ to, body: 'Voting closes today.' });
 * if (result.status === 'rejected' && result.retryable) {
 *   // Only a throttled send reaches here. See FAILURE_BY_CODE.
 * }
 * ```
 */
export const createTwilioProvider = ({
  client,
  messagingServiceSid,
  verifyServiceSid,
}: {
  client: TwilioRestClient;
  messagingServiceSid: string;
  verifyServiceSid?: string;
}): SmsProvider => {
  /**
   * Implements {@link SmsProvider.sendSms} against Twilio's Message resource.
   *
   * Never retries. Twilio's message API carries no idempotency key, so a
   * retried timeout can deliver the message twice and bill for both. A caller
   * that wants a retry records the attempt first.
   */
  const sendSms = async ({
    to,
    body,
  }: {
    to: PhoneNumber;
    body: string;
  }): Promise<SmsSendResult> => {
    try {
      const message = await client.messages.create({
        to,
        body,
        messagingServiceSid,
      });
      return { status: 'accepted', providerMessageId: message.sid };
    } catch (error) {
      return { status: 'rejected', ...toRejection(error, 'sendSms') };
    }
  };

  if (!verifyServiceSid) {
    return { sendSms };
  }

  /** Binds the configured Verify service, which both verification calls use. */
  const verifyService = () => client.verify.v2.services(verifyServiceSid);

  return {
    sendSms,

    /**
     * Implements {@link SmsProvider.startVerification} against Twilio Verify.
     *
     * Twilio generates the code, texts it, and holds it. We never see it.
     * Verify traffic is also exempt from A2P 10DLC registration, so this call
     * works before a campaign is approved.
     */
    startVerification: async ({
      to,
      locale,
    }: {
      to: PhoneNumber;
      locale?: string;
    }): Promise<VerificationStart> => {
      try {
        await verifyService().verifications.create({
          to,
          channel: 'sms',
          ...(locale ? { locale } : {}),
        });
        return { status: 'pending' };
      } catch (error) {
        return {
          status: 'rejected',
          ...toRejection(error, 'startVerification'),
        };
      }
    },

    /**
     * Implements {@link SmsProvider.checkVerification} against Twilio Verify.
     *
     * Separates a wrong code from an expired verification. Twilio reports the
     * two differently, and a participant who retypes a correct code against an
     * expired verification would otherwise be told the code was wrong.
     */
    checkVerification: async ({
      to,
      code,
    }: {
      to: PhoneNumber;
      code: string;
    }): Promise<VerificationCheck> => {
      try {
        const check = await verifyService().verificationChecks.create({
          to,
          code,
        });
        // Twilio answers `pending` when the code did not match, and `canceled`
        // when the verification was stopped. Only `approved` confirms it.
        return check.status === 'approved'
          ? { status: 'approved' }
          : { status: 'rejected' };
      } catch (error) {
        // A check against an expired or already-consumed verification 404s
        // rather than returning a wrong-code answer. Treated as "start over"
        // so the caller does not report it to the participant as a bad code.
        if (asRestError(error)?.status === 404) {
          return { status: 'expired' };
        }
        throw error;
      }
    },
  };
};
