import { switchUserOrganization } from '@op/common';
import { logger } from '@op/logging';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { userEncoder } from '../../encoders';
import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { commonProcedure, router } from '../../trpcFactory';

const endpoint = 'updateLastOrgId';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'PUT',
    path: `/account/${endpoint}`,
    protect: true,
    tags: ['account'],
    summary: 'Update user lastOrgId',
  },
};

export const switchOrganization = router({
  switchOrganization: commonProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 5 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(z.object({ organizationId: z.string().min(1) }))
    .output(userEncoder)
    .mutation(async ({ input, ctx }) => {
      const { id } = ctx.user;

      try {
        const result = await switchUserOrganization({
          authUserId: id,
          organizationId: input.organizationId,
        });
        return userEncoder.parse(result);
      } catch (error) {
        logger.error('Error switching organization', {
          error,
          organizationId: input.organizationId,
        });

        if (error instanceof Error) {
          if (error.message === 'Organization not found') {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Organization not found',
            });
          }
          if (error.message === 'User not found') {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'User not found',
            });
          }
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update currentProfileId',
        });
      }
    }),
});
