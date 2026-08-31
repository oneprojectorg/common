/** Why asking for a code failed. */
export type PhoneCodeFailure =
  | 'rate_limited'
  | 'unreachable'
  | 'unavailable'
  | 'unknown';

/** Why checking a code failed. */
export type PhoneVerifyFailure =
  | 'wrong_code'
  | 'expired'
  | 'session_failed'
  | 'rate_limited'
  | 'unavailable'
  | 'unknown';

/**
 * What a strategy reports back to the panel.
 *
 * A failure carries a reason the panel maps to its own copy, never a message
 * to render. A vendor writes its messages in English and describes its own
 * internals, and this application ships eight languages.
 *
 * `diagnostic` exists for the log. Nothing shows it to a person.
 */
export type PhoneCodeResult =
  | { ok: true }
  | { ok: false; reason: PhoneCodeFailure; diagnostic?: string };

/** As {@link PhoneCodeResult}, for the check rather than the request. */
export type PhoneVerifyResult =
  | { ok: true }
  | { ok: false; reason: PhoneVerifyFailure; diagnostic?: string };

/**
 * One way to sign a person in with a phone number and an SMS code.
 *
 * The panel depends on this and never on a vendor. Two implementations exist,
 * and they differ in where the work happens rather than in what they offer:
 *
 * - `createTwilioDirectStrategy` asks our own procedures, which call Twilio
 *   Verify, mint the session, and record the verification. This is the default,
 *   and the only path that makes an account a network member.
 * - `createSupabaseOtpStrategy` asks GoTrue, which asks Twilio. The browser
 *   talks to Supabase directly and our server is not involved, so no
 *   verification record exists and the account signs in as a non-member.
 *
 * A strategy is a factory rather than a hook, so the selection in
 * `usePhoneLogin` stays a plain conditional. A hook could not be chosen
 * conditionally without breaking the rules of hooks.
 *
 * Both leave a live Supabase session behind on success. Everything after
 * sign-in reads that session, so a strategy that only proved ownership of a
 * number has not finished the job.
 *
 * Each strategy translates its own vendor's failures into the reasons above.
 * The distinctions exist because they need different instructions: retype the
 * code, ask for a new one, or wait. `session_failed` matters most — the code
 * was right, so telling the person it was wrong sends them retyping forever.
 */
export interface PhoneAuthStrategy {
  /** Asks for a code to be texted to `phone`. */
  requestCode(phone: string): Promise<PhoneCodeResult>;

  /**
   * Checks the code and establishes the session.
   *
   * @param input.displayName - A name for an account being created. A strategy
   *   that cannot carry one ignores it.
   */
  verifyCode(input: {
    phone: string;
    code: string;
    displayName?: string;
  }): Promise<PhoneVerifyResult>;
}
