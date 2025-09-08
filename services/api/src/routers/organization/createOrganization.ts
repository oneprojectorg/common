import { invalidate } from '@op/cache';
import { UnauthorizedError, createOrganization } from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';

import { organizationsEncoder } from '../../encoders/organizations';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';
import { createOrganizationInputSchema } from './validators';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'POST',
    path: '/organization',
    protect: true,
    tags: ['organization'],
    summary: 'Create organization',
  },
};

export const createOrganizationRouter = router({
  create: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    // Router
    .meta(meta)
    .input(createOrganizationInputSchema)
    .output(organizationsEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      try {
        const org = await createOrganization({ data: input, user });

        logger.info('Organization created', {
          userId: user.id,
          organizationId: org.id,
          organizationName: org.profile.name,
        });

        // Invalidate user cache since organization membership has changed. This should be awaited since we want to kill cache BEFORE returning
        await invalidate({
          type: 'user',
          params: [ctx.user.id],
        });

        return organizationsEncoder.parse(org);
      } catch (error: unknown) {
        console.error('Failed to create organization', {
          userId: user.id,
          organizationName: input.name,
          error,
        });

        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: 'You do not have permission to create organizations',
            code: 'UNAUTHORIZED',
          });
        }

        throw new TRPCError({
          message: 'Failed to create organization',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
