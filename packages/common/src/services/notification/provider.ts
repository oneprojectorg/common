import twilio from 'twilio';

import { CommonError } from '../../utils/error';
import { createTwilioProvider } from './providers/twilio';
import type { SmsProvider } from './types';

/**
 * Rejects a Twilio identifier that was pasted into the wrong variable.
 *
 * Every Twilio SID carries a two-letter prefix naming its resource, so the
 * mistake is detectable here rather than at the first call. An Account SID in
 * the Messaging Service slot otherwise fails per message, and an API Key SID in
 * the account slot fails inside the SDK constructor, both far from the cause.
 *
 * @param name - The variable, so the message names what to correct.
 * @param value - The configured value. An unset variable passes.
 * @param prefix - The two letters the resource always starts with.
 * @throws {CommonError} When the value is set and carries another prefix.
 */
const assertSidPrefix = (
  name: string,
  value: string | undefined,
  prefix: string,
): void => {
  if (value && !value.startsWith(prefix)) {
    throw new CommonError(
      `${name} must start with ${prefix}, but it starts with ${value.slice(0, 2)}. Check which value was pasted into it.`,
    );
  }
};

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
 * Both service SIDs are optional, and at least one must be set, because an
 * account with no service can do nothing. `TWILIO_MESSAGING_SERVICE_SID`
 * switches on `sendSms`, once an A2P 10DLC campaign is approved.
 * `TWILIO_VERIFY_SERVICE_SID` switches on nothing here: GoTrue reads that
 * variable itself and confirms phone numbers without this provider. It is
 * still validated below, so a value pasted into the wrong slot fails at
 * startup rather than inside GoTrue.
 *
 * Two credentials work. An API key pair — `TWILIO_API_KEY_SID` with
 * `TWILIO_API_KEY_SECRET` — is preferred, because a key is scoped and can be
 * revoked on its own. `TWILIO_AUTH_TOKEN` is the account-wide fallback, and
 * rotating it breaks everything that uses it. Set one pair or the other.
 *
 * Note the import. `twilio` is CommonJS and publishes no `exports` map, so
 * `import { Twilio } from 'twilio'` throws `SyntaxError: Named export not
 * found` under native ESM, even though Twilio's README shows that form. Only
 * the default import works. It fails at runtime rather than in `tsc` or
 * Vitest, so a passing test does not prove the import is right. Keep the
 * construction here and let callers take the provider.
 *
 * @returns The configured provider, or `null` when SMS is off. Check for
 *   `sendSms` before calling it. A Verify-only deployment returns a provider
 *   with no methods, which is the signup-phase shape.
 * @throws {CommonError} When a SID carries the wrong prefix, when no credential
 *   is set, when `TWILIO_API_KEY_SID` has no secret, or when neither service SID
 *   is set.
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
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid) {
    return null;
  }

  assertSidPrefix('TWILIO_ACCOUNT_SID', accountSid, 'AC');
  assertSidPrefix('TWILIO_API_KEY_SID', apiKeySid, 'SK');
  assertSidPrefix('TWILIO_VERIFY_SERVICE_SID', verifyServiceSid, 'VA');
  assertSidPrefix('TWILIO_MESSAGING_SERVICE_SID', messagingServiceSid, 'MG');

  if (apiKeySid && !apiKeySecret) {
    throw new CommonError(
      'TWILIO_API_KEY_SID is set but TWILIO_API_KEY_SECRET is missing.',
    );
  }

  if (!apiKeySid && !authToken) {
    throw new CommonError(
      'TWILIO_ACCOUNT_SID is set but no credential is. Set TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET, or TWILIO_AUTH_TOKEN.',
    );
  }

  if (!messagingServiceSid && !verifyServiceSid) {
    throw new CommonError(
      'TWILIO_ACCOUNT_SID is set but neither TWILIO_MESSAGING_SERVICE_SID nor TWILIO_VERIFY_SERVICE_SID is. Set at least one, or unset TWILIO_ACCOUNT_SID to turn SMS off.',
    );
  }

  return createTwilioProvider({
    client:
      apiKeySid && apiKeySecret
        ? new twilio.Twilio(apiKeySid, apiKeySecret, { accountSid })
        : new twilio.Twilio(accountSid, authToken),
    messagingServiceSid,
  });
};
