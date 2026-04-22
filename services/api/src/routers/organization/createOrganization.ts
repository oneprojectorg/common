import { invalidate } from '@op/cache';
import { createOrganization } from '@op/common';

import { organizationsEncoder } from '../../encoders/organizations';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { createOrganizationInputSchema } from './validators';

export const createOrganizationRouter = router({
  create: commonAuthedProcedure()
    .input(createOrganizationInputSchema)
    .output(organizationsEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;

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
    }),
});
