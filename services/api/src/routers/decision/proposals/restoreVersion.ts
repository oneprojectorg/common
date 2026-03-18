import { invalidate } from '@op/cache';
import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  restoreProposalVersion,
} from '@op/common';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { proposalEncoder } from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const restoreProposalVersionRouter = router({
  restoreProposalVersion: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .input(
      z.object({
        proposalId: z.uuid(),
        versionId: z.number().int().min(0),
      }),
    )
    .output(proposalEncoder)
    .mutation(async ({ ctx, input }) => {
      const { logger, user } = ctx;

      try {
        const proposal = await restoreProposalVersion({
          proposalId: input.proposalId,
          user,
          versionId: input.versionId,
        });

        await invalidate({
          type: 'profile',
          params: [proposal.profileId],
        });

        return proposalEncoder.parse(proposal);
      } catch (error: unknown) {
        logger.error('Failed to restore proposal version', {
          error,
          proposalId: input.proposalId,
          userId: user.id,
          versionId: input.versionId,
        });

        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: error.message,
          });
        }

        if (error instanceof NotFoundError) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message,
          });
        }

        if (error instanceof ValidationError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }

        if (error instanceof CommonError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to restore proposal version',
        });
      }
    }),
});
