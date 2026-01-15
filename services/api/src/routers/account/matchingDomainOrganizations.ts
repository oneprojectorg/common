import { matchingDomainOrganizations as getMatchingDomainOrganizations } from '@op/common';
import { z } from 'zod';

import { organizationsWithProfileEncoder } from '../../encoders';
import { commonAuthedProcedure, router } from '../../trpcFactory';

export const matchingDomainOrganizations = router({
  listMatchingDomainOrganizations: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 100 },
  })
    .input(z.undefined())
    .output(z.array(organizationsWithProfileEncoder))
    .query(async ({ ctx }) => {
      const result = await getMatchingDomainOrganizations({
        user: ctx.user,
      });

      return result.map((org) => organizationsWithProfileEncoder.parse(org));
    }),
});
