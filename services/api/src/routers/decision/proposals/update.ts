import { invalidate } from '@op/cache';
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  updateProposal,
} from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import {
  proposalEncoder,
  updateProposalInputSchema,
} from '../../../encoders/decision';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import withRateLimited from '../../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'PATCH',
    path: '/decision/proposal/{proposalId}',
    protect: true,
    tags: ['decision'],
    summary: 'Update proposal',
  },
};

export const updateProposalRouter = router({
  updateProposal: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 20 }))
    .use(withAuthenticated)
    .meta(meta)
    .input(
      z.object({
        proposalId: z.string().uuid(),
        data: updateProposalInputSchema,
      }),
    )
    .output(proposalEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;
      const { proposalId } = input;

      try {
        const proposal = await updateProposal({
          proposalId,
          data: input.data,
          user,
        });

        console.log('Proposal updated', {
          userId: user.id,
          proposalId,
          updates: Object.keys(input.data),
        });

        await invalidate({
          type: 'profile',
          params: [proposal.profileId],
        });

        return proposalEncoder.parse(proposal);
      } catch (error: unknown) {
        logger.error('Failed to update proposal', {
          userId: user.id,
          proposalId,
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
            cause: {
              fieldErrors: error.fieldErrors,
            },
          });
        }

        throw new TRPCError({
          message: 'Failed to update proposal',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
