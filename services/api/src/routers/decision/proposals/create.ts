import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  createProposal,
} from '@op/common';
import { TRPCError } from '@trpc/server';
import { waitUntil } from '@vercel/functions';
import type { OpenApiMeta } from 'trpc-to-openapi';

import {
  createProposalInputSchema,
  proposalEncoder,
} from '../../../encoders/legacyDecision';
import withAnalytics from '../../../middlewares/withAnalytics';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import withRateLimited from '../../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../../trpcFactory';
import { trackProposalSubmitted } from '../../../utils/analytics';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'POST',
    path: '/decision/proposal',
    protect: true,
    tags: ['decision'],
    summary: 'Create proposal for decision process',
  },
};

export const createProposalRouter = router({
  createProposal: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(createProposalInputSchema)
    .output(proposalEncoder)
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

        return proposalEncoder.parse(proposal);
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
