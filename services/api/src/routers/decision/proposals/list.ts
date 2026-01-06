import { UnauthorizedError, listProposals } from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';

import {
  legacyProposalFilterSchema,
  legacyProposalListEncoder,
} from '../../../encoders/legacyDecision';
import withAnalytics from '../../../middlewares/withAnalytics';
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
    .use(withAnalytics)
    .meta(meta)
    .input(legacyProposalFilterSchema)
    .output(legacyProposalListEncoder)
    .query(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      try {
        const result = await listProposals({
          input: { ...input, authUserId: user.id },
          user,
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
