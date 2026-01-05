import { deleteOrganization } from '@op/common';
import { profiles } from '@op/db/schema';
import { logger } from '@op/logging';
import { TRPCError } from '@trpc/server';
import { createSelectSchema } from 'drizzle-zod';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const outputSchema = z.object({
  success: z.boolean(),
  deletedId: z.string().uuid(),
});

const inputSchema = z.object({
  organizationProfileId: z.uuid(),
});

export const deleteOrganizationRouter = router({
  deleteOrganization: commonAuthedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 5 },
  })
    .input(inputSchema)
    .output(outputSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationProfileId } = input;
      const { user } = ctx;

      try {
        const deletedOrganization = await deleteOrganization({
          organizationProfileId,
          user,
        });

        return outputSchema.parse(deletedOrganization);
      } catch (error: unknown) {
        logger.error('Error deleting organization', {
          error,
          organizationProfileId,
        });

        if (error instanceof Error) {
          if (error.name === 'UnauthorizedError') {
            throw new TRPCError({
              message: error.message,
              code: 'UNAUTHORIZED',
            });
          }
          if (error.name === 'NotFoundError') {
            throw new TRPCError({
              message: error.message,
              code: 'NOT_FOUND',
            });
          }
          if (error.name === 'AccessError') {
            throw new TRPCError({
              message: 'You do not have permission to delete organizations',
              code: 'UNAUTHORIZED',
            });
          }
        }

        throw new TRPCError({
          message: 'Failed to delete organization',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
