import { cache } from '@op/cache';
import { getAllowListUser } from '@op/common';
import {
  APP_NAME,
  adminEmails,
  allowedEmailDomains,
  genericEmail,
} from '@op/core';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withRateLimited from '../../middlewares/withRateLimited';
import { createSBAdminClient } from '../../supabase/server';
import { commonProcedure, router } from '../../trpcFactory';

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
  login: commonProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 3 }))
    // Router
    .meta(meta)
    .input(
      z.object({
        email: z.email().toLowerCase().trim(),
        usingOAuth: z.boolean().optional(),
      }),
    )
    .output(z.boolean())
    .query(async ({ input, ctx }) => {
      const { logger } = ctx;
      const emailDomain = input.email.split('@')[1];

      logger.info('Login attempt', {
        email: input.email,
        emailDomain,
        usingOAuth: input.usingOAuth,
      });

      if (!emailDomain) {
        logger.warn('Login failed - invalid email', { email: input.email });
        throw new TRPCError({
          message: 'Invalid email',
          code: 'BAD_REQUEST',
        });
      }

      const allowedUserEmail = await cache<ReturnType<typeof getAllowListUser>>(
        {
          type: 'allowList',
          params: [input.email],
          fetch: () => getAllowListUser({ email: input.email }),
        },
      );

      // If the user is not invited, add them to the waitlist
      if (
        !allowedUserEmail?.email &&
        !allowedEmailDomains.includes(emailDomain) &&
        !adminEmails.includes(input.email)
      ) {
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
          logger.error('Login error', {
            error: authResponse.error,
            email: input.email,
          });
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
