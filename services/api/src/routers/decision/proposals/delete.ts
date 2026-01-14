import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  deleteProposal as deleteProposalService,
} from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAnalytics from '../../../middlewares/withAnalytics';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import withRateLimited from '../../../middlewares/withRateLimited';
import { commonProcedure, router } from '../../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'DELETE',
    path: '/decision/proposal/{proposalId}',
    protect: true,
    tags: ['decision'],
    summary: 'Delete proposal',
  },
};

export const deleteProposalRouter = router({
  deleteProposal: commonProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 5 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(
      z.object({
        proposalId: z.uuid(),
      }),
    )
    .output(
      z.object({
        success: z.boolean(),
        deletedId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      try {
        const result = await deleteProposalService({
          proposalId: input.proposalId,
          user,
        });

        logger.info('Proposal deleted', {
          userId: user.id,
          proposalId: input.proposalId,
        });

        return result;
      } catch (error: unknown) {
        logger.error('Failed to delete proposal', {
          userId: user.id,
          proposalId: input.proposalId,
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

        if (error instanceof ValidationError) {
          throw new TRPCError({
            message: error.message,
            code: 'BAD_REQUEST',
          });
        }

        throw new TRPCError({
          message: 'Failed to delete proposal',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
