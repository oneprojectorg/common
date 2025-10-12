import { validateAtprotoLogin } from '@op/common';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAnalytics from '../../middlewares/withAnalytics';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const endpoint = 'loginAtproto';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: `/account/${endpoint}`,
    protect: false,
    tags: ['account'],
    summary: 'Validate AT Protocol login',
  },
};

const loginAtproto = router({
  loginAtproto: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 5 }))
    .use(withAnalytics)
    .meta(meta)
    .input(
      z.object({
        did: z.string().regex(/^did:(plc|web):.+$/),
        email: z.string().email().toLowerCase().trim(),
        usingOAuth: z.literal(true),
      })
    )
    .output(z.boolean())
    .query(async ({ input, ctx }) => {
      const { logger } = ctx;

      logger.info('AT Protocol login attempt', {
        did: input.did,
        email: input.email,
      });

      return validateAtprotoLogin(input);
    }),
});

export default loginAtproto;
