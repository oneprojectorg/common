import { trackRelationshipAdded } from '@op/analytics';
import {
  UnauthorizedError,
  addRelationship,
  sendRelationshipNotification,
} from '@op/common';
import { getSession, getCurrentOrgId } from '@op/common/src/services/access';
import { db } from '@op/db/client';
import { TRPCError } from '@trpc/server';
import { waitUntil } from '@vercel/functions';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

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

        if (!session.user.lastProfileId && !session.user.lastOrgId) {
          throw new UnauthorizedError('No user lastProfileId or lastOrgId found');
        }

        // TODO: We pull the org ID to add ORG relationships. We are transitioning to profile relationships. This should go away eventually
        const from = await getCurrentOrgId({ database: db });

        await addRelationship({
          user,
          from,
          to,
          relationships,
        });

        // Track analytics and trigger async processes
        waitUntil(
          Promise.all([
            trackRelationshipAdded(user.id, relationships),
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
