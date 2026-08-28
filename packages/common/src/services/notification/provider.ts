import twilio from 'twilio';

import { CommonError } from '../../utils/error';
import { createTwilioProvider } from './providers/twilio';
import type { SmsProvider } from './types';

/**
 * Resolves the configured SMS vendor from the environment.
 *
 * Call this at the edge — a tRPC procedure, a workflow function, an API route
 * — and pass the result into the service that needs it. A service that calls
 * this itself reads the environment, which makes it hard to test. The
 * moderation service resolves its own provider the same way.
 *
 * Returns `null` when `TWILIO_ACCOUNT_SID` is unset. SMS is then off, and a
 * checkout with no Twilio account behaves as it did before SMS existed. Treat
 * `null` as a working state and skip the send, rather than as an error.
 *
 * A partial configuration throws instead. Half-set credentials are an operator
 * mistake, and turning SMS off silently would hide it until a participant
 * failed to receive a code.
 *
 * `TWILIO_VERIFY_SERVICE_SID` stays optional. Without it the returned provider
 * omits `startVerification` and `checkVerification`, so a deployment that only
 * sends notifications needs no Verify service.
 *
 * Note the import. `twilio` is CommonJS and publishes no `exports` map, so
 * `import { Twilio } from 'twilio'` throws `SyntaxError: Named export not
 * found` under native ESM, even though Twilio's README shows that form. Only
 * the default import works. It fails at runtime rather than in `tsc` or
 * Vitest, so a passing test does not prove the import is right. Keep the
 * construction here and let callers take the provider.
 *
 * @returns The configured provider, or `null` when SMS is off.
 * @throws {CommonError} When `TWILIO_ACCOUNT_SID` is set and either
 *   `TWILIO_AUTH_TOKEN` or `TWILIO_MESSAGING_SERVICE_SID` is missing.
 *
 * @example Resolve at the edge, inject into the service
 * ```ts
 * const provider = getSmsProvider();
 * if (provider) {
 *   await notifyParticipant({ profileId }, { provider });
 * }
 * ```
 *
 * @see {@link https://www.twilio.com/docs/iam/api-keys}
 */
export const getSmsProvider = (): SmsProvider | null => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid) {
    return null;
  }

  if (!authToken) {
    throw new CommonError(
      'TWILIO_ACCOUNT_SID is set but TWILIO_AUTH_TOKEN is missing.',
    );
  }

  if (!messagingServiceSid) {
    throw new CommonError(
      'TWILIO_ACCOUNT_SID is set but TWILIO_MESSAGING_SERVICE_SID is missing. Sends must go through a Messaging Service.',
    );
  }

  return createTwilioProvider({
    client: new twilio.Twilio(accountSid, authToken),
    messagingServiceSid,
    verifyServiceSid,
  });
};
