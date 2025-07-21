import { matchingDomainOrganizations as getMatchingDomainOrganizations } from '@op/common';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { organizationsWithProfileEncoder } from '../../encoders';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: `/account/matching-organizations`,
    protect: true,
    tags: ['account'],
    summary: 'Get organizations with matching email domain',
  },
};

export const matchingDomainOrganizations = router({
  listMatchingDomainOrganizations: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 100 }))
    .use(withAuthenticated)
    // Router
    .meta(meta)
    .input(z.undefined())
    .output(z.array(organizationsWithProfileEncoder))
    .query(async ({ ctx }) => {
      const result = await getMatchingDomainOrganizations({
        user: ctx.user,
      });

      return result.map((org) => organizationsWithProfileEncoder.parse(org));
    }),
});
