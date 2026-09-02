/**
 * Vendor-agnostic SMS contracts.
 *
 * Import from here to send an SMS or to confirm a phone number. Nothing in
 * this file names a vendor, so a call site written against it survives a
 * change of vendor. The concrete adapters live in `providers/`, and
 * `getSmsProvider` picks one from the environment.
 */

/**
 * An E.164 phone number, such as `+15005550006`, that has passed validation.
 *
 * Obtain one from `parsePhoneNumber` in `schemas.ts`. That function is the only
 * way to produce this type, so an unchecked string cannot reach a vendor. The
 * brand exists for that reason alone; at runtime the value is a plain string.
 */
export type PhoneNumber = string & { readonly __brand: 'PhoneNumber' };

/**
 * Why a send or a verification failed, in our vocabulary rather than a
 * vendor's.
 *
 * Switch on this to decide what a caller does next. Each adapter maps its own
 * error codes onto this set, so no caller reads a vendor code. Adding a member
 * here means every adapter must map to it.
 */
export type SmsFailureReason =
  /** The vendor throttled us. This is the only reason that a retry can fix. */
  | 'rate_limited'
  /** The recipient replied STOP. Another send is a compliance breach. */
  | 'opted_out'
  /** The sender is not registered for the destination, such as A2P 10DLC. */
  | 'unregistered_sender'
  /** The carrier dropped the message. */
  | 'carrier_filtered'
  /** The vendor's fraud screening blocked the message. */
  | 'blocked_fraud'
  /** The number is unreachable, or it is not a mobile line. */
  | 'invalid_number'
  /** The vendor failed for a reason no adapter maps yet. */
  | 'unknown';

/**
 * The outcome of handing one message to a vendor.
 *
 * Narrow on `status` before reading the other fields.
 *
 * `accepted` reports that the vendor took the request. It does not report
 * delivery. Delivery arrives later, on a status callback. The member is named
 * `accepted` rather than `sent` so that no caller can read a resolved promise
 * as proof that a participant received the message.
 *
 * @example Act on the outcome
 * ```ts
 * const result = await provider.sendSms({ to, body });
 * if (result.status === 'accepted') {
 *   await recordAttempt(result.providerMessageId);
 * } else if (result.retryable) {
 *   await scheduleRetry();
 * }
 * ```
 */
export type SmsSendResult =
  | { status: 'accepted'; providerMessageId: string }
  | { status: 'rejected'; reason: SmsFailureReason; retryable: boolean };

/**
 * One SMS vendor, behind our own vocabulary.
 *
 * Depend on this type in a service, and take the provider as an argument.
 * `getSmsProvider` resolves the configured vendor at the edge, such as a tRPC
 * procedure or a workflow function, and passes it in. A service that resolves
 * its own provider reads the environment, which makes it hard to test.
 *
 * `sendSms` is optional, and it answers for a capability the deployment
 * configures separately. Check for it before you call it. `ModerationProvider`
 * marks its own capabilities optional for the same reason.
 *
 * This interface does not confirm a phone number. GoTrue owns that lifecycle
 * through `[auth.sms.twilio_verify]`, and the browser calls GoTrue directly, so
 * no code of ours generates or checks a code. ADR 0003 records that decision.
 *
 * @interface
 * @example Take a provider rather than resolving one
 * ```ts
 * const notify = async (
 *   { to, body }: { to: PhoneNumber; body: string },
 *   deps: { provider: SmsProvider },
 * ) => {
 *   if (!deps.provider.sendSms) {
 *     throw new Error('This deployment cannot send an SMS.');
 *   }
 *   return deps.provider.sendSms({ to, body });
 * };
 * ```
 */
export interface SmsProvider {
  /**
   * Hands one message to the vendor.
   *
   * Present only once the deployment can send. A Messaging Service is what
   * carries an A2P 10DLC registration, so this method is absent until one is
   * configured. Check for it before calling.
   *
   * Never retries. Vendor message APIs carry no idempotency key, so a retried
   * timeout can deliver twice and bill twice. A caller that wants a retry
   * records the attempt first.
   *
   * @param input.to - The recipient.
   * @param input.body - The message text. Keep it plain: one emoji or one
   *   curly quote moves the whole body to a 67-character segment.
   * @returns Acceptance and a vendor message id, or a rejection. See
   *   {@link SmsSendResult} on why acceptance is not delivery.
   */
  sendSms?(input: { to: PhoneNumber; body: string }): Promise<SmsSendResult>;
}
