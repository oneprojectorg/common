import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  createProposal,
} from '@op/common';
import { TRPCError } from '@trpc/server';
import { waitUntil } from '@vercel/functions';

import {
  legacyCreateProposalInputSchema,
  legacyProposalEncoder,
} from '../../../encoders/legacyDecision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';
import { trackProposalSubmitted } from '../../../utils/analytics';

export const createProposalRouter = router({
  createProposal: commonAuthedProcedure()
    .input(legacyCreateProposalInputSchema)
    .output(legacyProposalEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;
      const { processInstanceId } = input;

      try {
        const proposal = await createProposal({
          data: { ...input, authUserId: user.id },
          authUserId: user.id,
        });

        waitUntil(
          trackProposalSubmitted(ctx, processInstanceId, proposal.id, {
            // Keep the original timestamp format for consistency
            created_timestamp: Date.now(),
          }),
        );

        return legacyProposalEncoder.parse(proposal);
      } catch (error: unknown) {
        logger.error('Failed to create proposal', {
          userId: user.id,
          processInstanceId: input.processInstanceId,
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
          message: 'Failed to create proposal',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
