import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  submitProposal,
} from '@op/common';
import { TRPCError } from '@trpc/server';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { legacyProposalEncoder } from '../../../encoders/legacyDecision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';
import { trackProposalSubmitted } from '../../../utils/analytics';

const submitProposalInputSchema = z.object({
  proposalId: z.uuid(),
  proposalData: z.record(z.string(), z.unknown()),
  attachmentIds: z.array(z.string()).optional(),
});

export const submitProposalRouter = router({
  /** Submits a draft proposal, transitioning it to 'submitted' status after validation. */
  submitProposal: commonAuthedProcedure()
    .input(submitProposalInputSchema)
    .output(legacyProposalEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      try {
        const proposal = await submitProposal({
          data: input,
          authUserId: user.id,
        });

        // Fire analytics after successful submission
        waitUntil(
          trackProposalSubmitted(ctx, proposal.processInstanceId, proposal.id, {
            created_timestamp: Date.now(),
          }),
        );

        return legacyProposalEncoder.parse(proposal);
      } catch (error: unknown) {
        logger.error('Failed to submit proposal', {
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
            cause: {
              fieldErrors: error.fieldErrors,
            },
          });
        }

        throw new TRPCError({
          message: 'Failed to submit proposal',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
