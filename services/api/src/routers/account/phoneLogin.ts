import {
  CommonError,
  RateLimitError,
  SMS_LOGIN_FLAG,
  UnauthorizedError,
  allowPhoneSend,
  getSmsProvider,
  isServerFeatureEnabled,
  normalizePhoneNumber,
  parsePhoneNumber,
} from '@op/common';
import { z } from 'zod';

import withRateLimited from '../../middlewares/withRateLimited';
import { mintPhoneSession } from '../../supabase/mintPhoneSession';
import { commonProcedure, router } from '../../trpcFactory';

/**
 * Signing in with a phone number and an SMS code.
 *
 * Twilio Verify owns the code. It generates one, sends it, and checks it, so
 * neither this server nor GoTrue ever holds it. A successful check mints a
 * Supabase session, because the rest of the application reads one.
 *
 * Anyone may create an account here. The email flow in `login.ts` gates
 * creation on the allow list, the permitted domains, and the admin list; this
 * one gates nothing, because a phone number belongs to no domain and appears
 * on no list.
 *
 * A session is all it grants. Network membership reads an email address, so
 * an account created here signs in and stays outside the closed network.
 */
const phoneLogin = router({
  /**
   * Asks Twilio to text a code to `phone`.
   *
   * The rate limit is ours to enforce. This flow never calls GoTrue's OTP
   * endpoints, so nothing else throttles a caller.
   *
   * Two limits apply, because each send costs money and this endpoint answers
   * the public internet before any identity exists. The middleware counts
   * requests per address; `allowPhoneSend` counts codes per number, in Redis,
   * so a deploy or a second instance does not reset it.
   */
  startPhoneLogin: commonProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 3 }))
    .input(z.object({ phone: z.string() }))
    .output(z.object({ status: z.enum(['pending', 'rejected']) }))
    .mutation(async ({ input, ctx }) => {
      const provider = await requireVerification();
      const to = parsePhoneNumber(normalizePhoneNumber(input.phone));

      if (!(await allowPhoneSend(to))) {
        throw new RateLimitError(
          'Too many codes were sent to this number. Try again later.',
        );
      }

      const result = await provider.startVerification({ to });

      if (result.status === 'rejected') {
        ctx.logger.warn('Phone verification refused', {
          reason: result.reason,
        });
      }

      return { status: result.status };
    }),

  /**
   * Checks the code and signs the person in.
   *
   * Reports a wrong code and an expired verification differently. A participant
   * who retypes a correct code against an expired verification would otherwise
   * be told the code was wrong, and would keep retyping it.
   */
  verifyPhoneLogin: commonProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 5 }))
    .input(
      z.object({
        phone: z.string(),
        code: z.string().min(4).max(10),
        displayName: z.string().trim().min(1).max(256).optional(),
      }),
    )
    .output(
      z.discriminatedUnion('status', [
        z.object({
          status: z.literal('approved'),
          accessToken: z.string(),
          refreshToken: z.string(),
        }),
        z.object({ status: z.literal('rejected') }),
        z.object({ status: z.literal('expired') }),
      ]),
    )
    .mutation(async ({ input, ctx }) => {
      const provider = await requireVerification();
      const to = parsePhoneNumber(normalizePhoneNumber(input.phone));

      const check = await provider.checkVerification({ to, code: input.code });

      if (check.status !== 'approved') {
        ctx.logger.warn('Phone verification was not approved', {
          status: check.status,
        });
        return { status: check.status };
      }

      const session = await mintPhoneSession({
        phone: to,
        displayName: input.displayName,
      });

      ctx.logger.info('Phone sign-in approved');

      return {
        status: 'approved' as const,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      };
    }),
});

/**
 * Resolves the SMS vendor, and refuses to continue without verification.
 *
 * `getSmsProvider` returns `null` when SMS is off, and omits the verification
 * pair when no Verify service is configured. Both mean this route cannot work,
 * and both are operator mistakes rather than caller mistakes.
 */
const requireVerification = async () => {
  // The panel hides the option when the flag is off. This refuses the call as
  // well, which is what keeps the feature closed on this path. The `supabase`
  // strategy never reaches here, so an account can still be created through
  // GoTrue with the flag off — it just holds no verification record, and
  // `getNetworkMembership` reads the same flag before admitting anyone.
  if (!(await isServerFeatureEnabled(SMS_LOGIN_FLAG))) {
    throw new UnauthorizedError('Phone sign-in is not available.');
  }

  const provider = getSmsProvider();
  if (!provider?.startVerification || !provider.checkVerification) {
    throw new CommonError(
      'Phone sign-in is not configured. Set TWILIO_VERIFY_SERVICE_SID.',
    );
  }
  return {
    startVerification: provider.startVerification,
    checkVerification: provider.checkVerification,
  };
};

export default phoneLogin;
