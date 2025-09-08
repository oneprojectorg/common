import { trackProposalViewed } from '@op/analytics';
import { UnauthorizedError, NotFoundError, getProposal } from '@op/common';
import { TRPCError } from '@trpc/server';
import { waitUntil } from '@vercel/functions';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { proposalEncoder } from '../../../encoders/decision';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import { loggedProcedure, router } from '../../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/decision/proposal/{proposalId}',
    protect: true,
    tags: ['decision'],
    summary: 'Get proposal details',
  },
};

export const getProposalRouter = router({
  getProposal: loggedProcedure
    .use(withAuthenticated)
    .meta(meta)
    .input(
      z.object({
        proposalId: z.string().uuid(),
      })
    )
    .output(proposalEncoder)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;

      try {
        const proposal = await getProposal({
          proposalId: input.proposalId,
          user,
        });

        // Track proposal viewed event
        if (proposal.processInstance && typeof proposal.processInstance === 'object' && !Array.isArray(proposal.processInstance) && 'id' in proposal.processInstance) {
          waitUntil(
            trackProposalViewed(user.id, proposal.processInstance.id, proposal.id)
          );
        }

        return proposalEncoder.parse(proposal);
      } catch (error: unknown) {
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

        throw new TRPCError({
          message: 'Failed to fetch proposal',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});