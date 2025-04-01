import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { allowedEmailDomains, APP_NAME, genericEmail } from '@op/core';

import withRateLimited from '../../middlewares/withRateLimited';
import { createSBAdminClient } from '../../supabase/server';
import { loggedProcedure, router } from '../../trpcFactory';

import type { OpenApiMeta } from 'trpc-to-openapi';

const endpoint = 'login';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: `/account/${endpoint}`,
    protect: true,
    tags: ['account'],
    summary: 'Login via email',
  },
};

const login = router({
  login: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 3 }))
    // Router
    .meta(meta)
    .input(
      z.object({
        email: z.string().email().toLowerCase().trim(),
        usingOAuth: z.boolean().optional(),
      }),
    )
    .output(z.boolean())
    .query(async ({ input, ctx }) => {
      const emailDomain = input.email.split('@')[1];

      if (!emailDomain) {
        throw new TRPCError({
          message: 'Invalid email',
          code: 'BAD_REQUEST',
        });
      }

      // If the user is not invited, add them to the waitlist
      if (!allowedEmailDomains.includes(emailDomain)) {
        throw new TRPCError({
          message: `${APP_NAME} is invite-only! You’re now on the waitlist. Keep an eye on your inbox for updates.`,
          code: 'FORBIDDEN',
        });
      }

      // If the user is not using OAuth and doesn't have a token, send them an OTP
      if (!input.usingOAuth) {
        const supabase = createSBAdminClient(ctx);

        const authResponse = await supabase.auth.signInWithOtp({
          email: input.email,
          options: {
            shouldCreateUser: true,
          },
        });

        if (authResponse.error) {
          throw new TRPCError({
            message: `There was an error signing you in. We are currently investigating the issue. Please try again in a few minutes. If you need further assistance, don't hesitate to contact us at ${genericEmail}`,
            code: 'INTERNAL_SERVER_ERROR',
          });
        }
      }

      return true;
    }),
});

export default login;
