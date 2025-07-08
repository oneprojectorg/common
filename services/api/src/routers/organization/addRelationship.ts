import { UnauthorizedError, addRelationship } from '@op/common';
import { getSession } from '@op/common/src/services/access';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';
import { trackRelationshipAdded } from '../../utils/analytics';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  // from: z.string().uuid({ message: 'Invalid source organization ID' }),
  to: z.string().uuid({ message: 'Invalid target organization ID' }),
  relationships: z.array(z.string()),
});

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'POST',
    path: '/organization/relationship',
    protect: true,
    tags: ['organization'],
    summary: 'Add organization relationship',
  },
};

export const addRelationshipRouter = router({
  addRelationship: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .meta(meta)
    .input(inputSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { to, relationships } = input;

      try {
        const session = await getSession();
        if (!session) {
          throw new UnauthorizedError('No user found');
        }

        await addRelationship({
          user,
          from: session.user.lastOrgId,
          to,
          relationships,
        });

        // Track analytics
        await trackRelationshipAdded(user.id, relationships);

        return { success: true };
      } catch (error: unknown) {
        console.log('ERROR', error);
        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: error.message,
            code: 'UNAUTHORIZED',
          });
        }
        throw new TRPCError({
          message: 'Failed to create relationship',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
