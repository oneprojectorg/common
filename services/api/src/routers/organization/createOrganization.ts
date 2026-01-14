import { invalidate } from '@op/cache';
import { UnauthorizedError, createOrganization } from '@op/common';
import { TRPCError } from '@trpc/server';

import { organizationsEncoder } from '../../encoders/organizations';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { createOrganizationInputSchema } from './validators';

export const createOrganizationRouter = router({
  create: commonAuthedProcedure()
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
        logger.error('Failed to create organization', {
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
