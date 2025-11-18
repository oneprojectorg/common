import { invalidate } from '@op/cache';
import { joinOrganization as joinOrganizationService } from '@op/common';
import { db } from '@op/db/client';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'POST',
    path: `/organization/join`,
    protect: true,
    tags: ['organization'],
    summary: 'Join an organization',
  },
};

const inputSchema = z.object({
  organizationId: z.uuid('Organization ID must be a valid UUID'),
});

export const joinOrganization = router({
  join: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 60, maxRequests: 5 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    // Router
    .meta(meta)
    .input(inputSchema)
    .output(
      z.object({
        organizationUserId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Fetch organization
        const organization = await db.query.organizations.findFirst({
          where: (table, { eq }) => eq(table.id, input.organizationId),
        });

        if (!organization) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Organization not found',
          });
        }

        const result = await joinOrganizationService({
          user: ctx.user,
          organization,
        });

        // Invalidate user cache since organization membership has changed. This should be awaited since we want to kill cache BEFORE returning
        await invalidate({
          type: 'user',
          params: [ctx.user.id],
        });

        return {
          organizationUserId: result?.id || '',
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to join organization';

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message,
        });
      }
    }),
});
