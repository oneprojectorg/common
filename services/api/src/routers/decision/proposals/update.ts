import { invalidate } from '@op/cache';
import {
  checkpointProposalUpdate,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  updateProposal,
} from '@op/common';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  checkpointProposalUpdateInputSchema,
  proposalEncoder,
  updateProposalInputSchema,
} from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const updateProposalRouter = router({
  updateProposal: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .input(
      z.object({
        proposalId: z.uuid(),
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
  checkpointProposalUpdate: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .input(
      z.object({
        proposalId: z.uuid(),
        data: checkpointProposalUpdateInputSchema,
      }),
    )
    .output(proposalEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;
      const { proposalId } = input;

      try {
        const proposal = await checkpointProposalUpdate({
          proposalId,
          data: input.data,
          user,
        });

        await invalidate({
          type: 'profile',
          params: [proposal.profileId],
        });

        return proposalEncoder.parse(proposal);
      } catch (error: unknown) {
        logger.error('Failed to checkpoint proposal update', {
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
          message: 'Failed to checkpoint proposal update',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
