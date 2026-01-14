import {
  ChannelName,
  Channels,
  UnauthorizedError,
  getDirectedRelationships,
  getPendingRelationships,
  getRelatedOrganizations,
} from '@op/common';
import { getCurrentOrgId } from '@op/common/src/services/access';
import { Organization } from '@op/db/schema';
import { logger } from '@op/logging';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const directedInputSchema = z.object({
  from: z.uuid({
    error: 'Invalid source organization ID',
  }),
  to: z
    .uuid({
      error: 'Invalid target organization ID',
    })
    .optional(),
  pending: z.boolean().optional(),
});

const nonDirectedInputSchema = z.object({
  organizationId: z.uuid({
    error: 'Invalid organization ID',
  }),
  // to: z.string().uuid({ message: 'Invalid target organization ID' }),
  pending: z.boolean().optional(),
});

export const listRelationshipsRouter = router({
  listPendingRelationships: commonAuthedProcedure()
    .input(z.void())
    .query(async ({ ctx }) => {
      const { user } = ctx;

      try {
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
  listDirectedRelationships: commonAuthedProcedure()
    .input(directedInputSchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { to, from, pending } = input;

      try {
        const defaultOrgId = await getCurrentOrgId({ authUserId: user.id });
        const { records: relationships, count } =
          await getDirectedRelationships({
            user,
            from,
            to: to ?? defaultOrgId,
            pending,
          });

        const targetOrgChannel: ChannelName = Channels.orgRelationshipRequest({
          type: 'target',
          orgId: from,
        });

        const sourceOrgIds = relationships.map(
          (relationship) =>
            (relationship.targetOrganization as Organization).id,
        );

        const sourceOrgChannels: ChannelName[] = sourceOrgIds.map((orgId) => {
          return Channels.orgRelationshipRequest({
            type: 'source',
            orgId,
          });
        });

        ctx.registerQueryChannels([...sourceOrgChannels, targetOrgChannel]);

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
  listRelationships: commonAuthedProcedure()
    .input(nonDirectedInputSchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { organizationId, pending } = input;

      try {
        const { records: organizations, count } = await getRelatedOrganizations(
          {
            user,
            orgId: organizationId,
            pending,
          },
        );

        return { organizations, count };
      } catch (error: unknown) {
        logger.error('Error listing relationships', { error, organizationId });
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
