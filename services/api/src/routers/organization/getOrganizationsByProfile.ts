import { getOrganizationsByProfile } from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { organizationsWithProfileEncoder } from '../../encoders/organizations';
import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/organization/by-profile/{profileId}',
    protect: true,
    tags: ['organization'],
    summary: 'Get organizations by profile access',
  },
};

export const getOrganizationsByProfileRouter = router({
  getOrganizationsByProfile: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(z.object({ profileId: z.uuid() }))
    .output(z.array(organizationsWithProfileEncoder))
    .query(async ({ input }) => {
      const { profileId } = input;

      try {
        const organizations = await getOrganizationsByProfile(profileId);

        return organizations.map((org) =>
          organizationsWithProfileEncoder.parse(org),
        );
      } catch (error) {
        console.error('Error getting organizations by profile:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get organizations by profile',
        });
      }
    }),
});
