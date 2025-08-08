import { UnauthorizedError, listProposals } from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';

import { proposalFilterSchema, proposalListEncoder } from '../../../encoders/decision';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import { loggedProcedure, router } from '../../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/decision/proposals',
    protect: true,
    tags: ['decision'],
    summary: 'List proposals with filtering',
  },
};

export const listProposalsRouter = router({
  listProposals: loggedProcedure
    .use(withAuthenticated)
    .meta(meta)
    .input(proposalFilterSchema)
    .output(proposalListEncoder)
    .query(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      try {
        const result = await listProposals({
          input,
          user,
        });

        logger.info('Proposals listed', {
          userId: user.id,
          filters: input,
          resultCount: result.proposals.length,
          total: result.total,
        });

        return result;
      } catch (error: unknown) {
        logger.error('Failed to list proposals', {
          userId: user.id,
          filters: input,
          error,
        });

        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: error.message,
            code: 'UNAUTHORIZED',
          });
        }

        throw new TRPCError({
          message: 'Failed to list proposals',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});