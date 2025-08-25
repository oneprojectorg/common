import {
  UnauthorizedError,
  getDirectedRelationships,
  getPendingRelationships,
  getRelatedOrganizations,
} from '@op/common';
import { getCurrentOrgId } from '@op/common/src/services/access';
import { TRPCError } from '@trpc/server';
// import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const directedInputSchema = z.object({
  from: z.string().uuid({ message: 'Invalid source organization ID' }),
  to: z.string().uuid({ message: 'Invalid target organization ID' }).optional(),
  pending: z.boolean().optional(),
});

const nonDirectedInputSchema = z.object({
  organizationId: z.string().uuid({ message: 'Invalid organization ID' }),
  // to: z.string().uuid({ message: 'Invalid target organization ID' }),
  pending: z.boolean().optional(),
});

// const directedMeta: OpenApiMeta = {
// openapi: {
// enabled: true,
// method: 'GET',
// path: '/organization/{from}/relationships/{to}',
// protect: true,
// tags: ['organization', 'relationships'],
// summary: 'List organization relationships to another organization',
// },
// };

// const nonDirectedMeta: OpenApiMeta = {
// openapi: {
// enabled: true,
// method: 'GET',
// path: '/organization/{from}/relationships',
// protect: true,
// tags: ['organization', 'relationships'],
// summary: 'List organization relationships',
// },
// };

export const listRelationshipsRouter = router({
  listPendingRelationships: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    // .meta(directedMeta)
    .input(z.void())
    .query(async ({ ctx }) => {
      const { user } = ctx;

      try {
        if (!user) {
          throw new UnauthorizedError('No user found');
        }

        const orgId = await getCurrentOrgId({ authUserId: user.id });
        const { records: organizations, count } = await getPendingRelationships(
          {
            user,
            orgId,
          },
        );

        return { organizations, count };
      } catch (error: unknown) {
        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: error.message,
            code: 'UNAUTHORIZED',
          });
        }
        throw new TRPCError({
          message: 'Could not retrieve relationships',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
  listDirectedRelationships: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    // .meta(directedMeta)
    .input(directedInputSchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { to, from, pending } = input;

      try {
        if (!user) {
          throw new UnauthorizedError('No user found');
        }

        const defaultOrgId = await getCurrentOrgId({ authUserId: user.id });
        const { records: relationships, count } =
          await getDirectedRelationships({
            user,
            from,
            to: to ?? defaultOrgId,
            pending,
          });

        return { relationships, count };
      } catch (error: unknown) {
        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: error.message,
            code: 'UNAUTHORIZED',
          });
        }
        throw new TRPCError({
          message: 'Could not retrieve relationships',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
  listRelationships: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    // .meta(nonDirectedMeta)
    .input(nonDirectedInputSchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { organizationId, pending } = input;

      try {
        if (!user) {
          throw new UnauthorizedError('No user found');
        }

        const { records: organizations, count } = await getRelatedOrganizations(
          {
            user,
            orgId: organizationId,
            pending,
          },
        );

        return { organizations, count };
      } catch (error: unknown) {
        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: error.message,
            code: 'UNAUTHORIZED',
          });
        }
        throw new TRPCError({
          message: 'Could not retrieve relationships',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
