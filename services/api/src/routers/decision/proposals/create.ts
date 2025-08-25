import { UnauthorizedError, NotFoundError, ValidationError, createProposal } from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';

import { createProposalInputSchema, proposalEncoder } from '../../../encoders/decision';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import withRateLimited from '../../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../../trpcFactory';

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
    .meta(meta)
    .input(createProposalInputSchema)
    .output(proposalEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      try {
        const proposal = await createProposal({
          data: { ...input, authUserId: user.id },
          user,
        });

        logger.info('Proposal created', {
          userId: user.id,
          proposalId: proposal.id,
          processInstanceId: input.processInstanceId,
        });

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
          });
        }

        throw new TRPCError({
          message: 'Failed to create proposal',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});