/** Why asking for a code failed. */
export type PhoneCodeFailure = 'rate_limited' | 'unavailable' | 'unknown';

/**
 * Why checking a code failed.
 *
 * GoTrue reports an expired verification and a wrong code with one error code,
 * so `expired` is a best reading rather than a certainty. Asking for a new code
 * recovers from both, which a bare "wrong code" would not.
 */
export type PhoneVerifyFailure = 'wrong_code' | 'expired' | 'unknown';

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
 * The panel depends on this and never on a vendor. One implementation exists:
 * `createSupabaseOtpStrategy` asks GoTrue, which asks Twilio Verify. The
 * browser talks to Supabase directly and our server is not involved.
 *
 * A confirmed number becomes network membership through a trigger on
 * `auth.users`, so nothing in this layer writes that record.
 *
 * A strategy is a factory rather than a hook, so a future selection between two
 * of them stays a plain conditional. A hook could not be chosen conditionally
 * without breaking the rules of hooks.
 *
 * Both leave a live Supabase session behind on success. Everything after
 * sign-in reads that session, so a strategy that only proved ownership of a
 * number has not finished the job.
 *
 * A strategy translates its vendor's failures into the reasons above. The
 * distinctions exist because they need different instructions: retype the code,
 * ask for a new one, or wait.
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
