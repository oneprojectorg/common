/** What `requestCode` reports back to the panel. */
export type PhoneCodeResult = { ok: true } | { ok: false; message?: string };

/** What `verifyCode` reports back to the panel. */
export type PhoneVerifyResult =
  | { ok: true }
  | { ok: false; expired: boolean; message?: string };

/**
 * One way to sign a person in with a phone number and an SMS code.
 *
 * The panel depends on this and never on a vendor. Two implementations exist,
 * and they differ in where the work happens rather than in what they offer:
 *
 * - `createSupabaseOtpStrategy` asks GoTrue, which asks Twilio. The browser
 *   talks to Supabase directly and our server is not involved.
 * - `createTwilioDirectStrategy` asks our own procedures, which call Twilio
 *   Verify and then mint the session.
 *
 * A strategy is a factory rather than a hook, so the selection in
 * `usePhoneLogin` stays a plain conditional. A hook could not be chosen
 * conditionally without breaking the rules of hooks.
 *
 * Both leave a live Supabase session behind on success. Everything after
 * sign-in reads that session, so a strategy that only proved ownership of a
 * number has not finished the job.
 *
 * Each strategy translates its own vendor's failures into the two result types
 * above. A wrong code and an expired verification stay distinct, because they
 * need opposite instructions: type it again, or ask for a new one.
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
