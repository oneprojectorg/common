import { trackRelationshipAdded } from '../../utils/analytics';
import {
  UnauthorizedError,
  addRelationship,
  sendRelationshipNotification,
} from '@op/common';
import { getCurrentOrgId } from '@op/common/src/services/access';
import { TRPCError } from '@trpc/server';
import { waitUntil } from '@vercel/functions';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAnalytics from '../../middlewares/withAnalytics';
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
    .use(withAnalytics)
    .meta(meta)
    .input(inputSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { to, relationships } = input;

      try {
        if (!user) {
          throw new UnauthorizedError('No user found');
        }

        // TODO: We pull the org ID to add ORG relationships. We are transitioning to profile relationships. This should go away eventually
        const from = await getCurrentOrgId({ authUserId: user.id });

        await addRelationship({
          user,
          from,
          to,
          relationships,
        });

        // Track analytics and trigger async processes
        waitUntil(
          Promise.all([
            trackRelationshipAdded(ctx, relationships),
            sendRelationshipNotification({
              from,
              to,
              relationships,
            }),
          ]),
        );

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
