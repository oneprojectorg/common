import { invalidate } from '@op/cache';
import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  updateProposalStatus,
} from '@op/common';
import { ProposalStatus } from '@op/db/schema';
import { logger } from '@op/logging';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { legacyProposalEncoder } from '../../../encoders/legacyDecision';
import withAnalytics from '../../../middlewares/withAnalytics';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import withRateLimited from '../../../middlewares/withRateLimited';
import { commonProcedure, router } from '../../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'PATCH',
    path: '/decision/proposal/{profileId}/status',
    protect: true,
    tags: ['decision'],
    summary: 'Update proposal status (approve/reject)',
  },
};

const updateProposalStatusInput = z.object({
  profileId: z.uuid(),
  status: z.enum([ProposalStatus.APPROVED, ProposalStatus.REJECTED]),
});

export const updateProposalStatusRouter = router({
  updateProposalStatus: commonProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 20 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(updateProposalStatusInput)
    .output(legacyProposalEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { profileId, status } = input;

      try {
        const proposal = await updateProposalStatus({
          profileId,
          status,
          user,
        });

        await invalidate({
          type: 'profile',
          params: [profileId],
        });

        return legacyProposalEncoder.parse(proposal);
      } catch (error: unknown) {
        logger.error('Failed to update proposal status', {
          userId: user.id,
          profileId,
          status,
          error,
        });

        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: error.message,
            code: 'UNAUTHORIZED',
          });
        }

        if (error instanceof NotFoundError) {
          throw new TRPCError({
            message: error.message,
            code: 'NOT_FOUND',
          });
        }

        if (error instanceof CommonError) {
          throw new TRPCError({
            message: error.message,
            code: 'BAD_REQUEST',
          });
        }

        throw new TRPCError({
          message: 'Failed to update proposal status',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
