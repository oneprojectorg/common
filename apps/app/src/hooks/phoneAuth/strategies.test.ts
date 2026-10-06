import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { createSupabaseOtpStrategy, getTwilioErrorCode } from './supabaseOtp';

const PHONE = '+15005550006';

/** The `more_info` URL Twilio attaches to a refusal, as GoTrue relays it. */
const twilioErrorUrl = (code: number) =>
  `https://www.twilio.com/docs/errors/${code}`;

describe('getTwilioErrorCode', () => {
  /**
   * Given GoTrue's message for a Twilio refusal
   * When the code is read
   * Then it is the number at the end of the Twilio error URL
   */
  it('reads the code from the Twilio error URL', () => {
    expect(
      getTwilioErrorCode(
        `Error sending sms OTP to provider: Max send attempts reached More information: ${twilioErrorUrl(60203)}`,
      ),
    ).toBe(60203);
  });

  /**
   * Given a GoTrue message that did not come from Twilio
   * When the code is read
   * Then there is none
   */
  it('reads nothing from a message without a Twilio error URL', () => {
    expect(getTwilioErrorCode('slow down')).toBeUndefined();
    expect(getTwilioErrorCode(undefined)).toBeUndefined();
  });
});

/** A Supabase client stubbed down to the three calls these strategies make. */
const stubClient = (auth: Record<string, unknown>) =>
  ({ auth }) as unknown as SupabaseClient;

describe('createSupabaseOtpStrategy', () => {
  it('reports success when GoTrue accepts the request', async () => {
    const strategy = createSupabaseOtpStrategy({
      supabase: stubClient({ signInWithOtp: async () => ({ error: null }) }),
    });

    await expect(strategy.requestCode(PHONE)).resolves.toEqual({ ok: true });
  });

  it('separates a send throttle from any other refusal', async () => {
    const strategy = createSupabaseOtpStrategy({
      supabase: stubClient({
        signInWithOtp: async () => ({
          error: { code: 'over_sms_send_rate_limit', message: 'slow down' },
        }),
      }),
    });

    // "Wait a minute" and "we could not send" are different instructions, and
    // a person who reads the wrong one keeps pressing the button.
    await expect(strategy.requestCode(PHONE)).resolves.toMatchObject({
      ok: false,
      reason: 'rate_limited',
    });
  });

  /**
   * Given Twilio Verify refused the send because the number hit its own
   * attempt cap (code 60203), which GoTrue reports as a generic 422
   * When the code is requested
   * Then the failure reads as a throttle, not as the service being down
   */
  it("reads Twilio's attempt cap as a throttle", async () => {
    const strategy = createSupabaseOtpStrategy({
      supabase: stubClient({
        signInWithOtp: async () => ({
          error: {
            code: 'sms_send_failed',
            status: 422,
            message: `Error sending sms OTP to provider: Max send attempts reached More information: ${twilioErrorUrl(60203)}`,
          },
        }),
      }),
    });

    await expect(strategy.requestCode(PHONE)).resolves.toMatchObject({
      ok: false,
      reason: 'rate_limited',
    });
  });

  /**
   * Given Twilio Verify refused the send with a message that names the
   * account, the service, and the number
   * When the code is requested
   * Then the diagnostic the strategy hands back carries none of them
   */
  it('strips the account, service, and number from the diagnostic', async () => {
    // Assembled at runtime: a literal SID-shaped string trips GitHub's push
    // protection even when it is made up.
    const accountSid = `AC${'01234567'.repeat(4)}`;
    const verifySid = `VA${'89abcdef'.repeat(4)}`;
    const strategy = createSupabaseOtpStrategy({
      supabase: stubClient({
        signInWithOtp: async () => ({
          error: {
            code: 'sms_send_failed',
            status: 422,
            message: `Error sending sms OTP to provider: Resource /v2/Services/${verifySid}/Verifications not found for account ${accountSid}, to ${PHONE} More information: ${twilioErrorUrl(20404)}`,
          },
        }),
      }),
    });

    const result = await strategy.requestCode(PHONE);

    expect(result).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(result.ok ? undefined : result.diagnostic).toBe(
      'Error sending sms OTP to provider: Resource /v2/Services/[twilio-sid]/Verifications not found for account [twilio-sid], to [phone] More information: https://www.twilio.com/docs/errors/20404',
    );
  });

  /**
   * Given Twilio Verify refused the send for any other reason
   * When the code is requested
   * Then the failure still reads as the service being unavailable
   */
  it('reads any other Twilio refusal as unavailable', async () => {
    const strategy = createSupabaseOtpStrategy({
      supabase: stubClient({
        signInWithOtp: async () => ({
          error: {
            code: 'sms_send_failed',
            status: 422,
            message: `Error sending sms OTP to provider: Invalid parameter \`To\`: ${PHONE} More information: ${twilioErrorUrl(60200)}`,
          },
        }),
      }),
    });

    await expect(strategy.requestCode(PHONE)).resolves.toMatchObject({
      ok: false,
      reason: 'unavailable',
    });
  });

  it('reads an expired verification as expired', async () => {
    const strategy = createSupabaseOtpStrategy({
      supabase: stubClient({
        verifyOtp: async () => ({
          data: {},
          error: { code: 'otp_expired', message: 'expired' },
        }),
      }),
    });

    await expect(
      strategy.verifyCode({ phone: PHONE, code: '123456' }),
    ).resolves.toMatchObject({ ok: false, reason: 'expired' });
  });

  it('treats a missing session as a refusal rather than a success', async () => {
    const strategy = createSupabaseOtpStrategy({
      supabase: stubClient({
        // GoTrue answers with neither an error nor a session for a wrong code.
        // Reading that as success would sign nobody in and reload the page
        // into a signed-out state.
        verifyOtp: async () => ({ data: { session: null }, error: null }),
      }),
    });

    await expect(
      strategy.verifyCode({ phone: PHONE, code: '000000' }),
    ).resolves.toMatchObject({ ok: false, reason: 'wrong_code' });
  });

  it('reports success once a session exists', async () => {
    const strategy = createSupabaseOtpStrategy({
      supabase: stubClient({
        verifyOtp: async () => ({
          data: { session: { access_token: 'a' } },
          error: null,
        }),
      }),
    });

    await expect(
      strategy.verifyCode({ phone: PHONE, code: '123456' }),
    ).resolves.toEqual({ ok: true });
  });
});
