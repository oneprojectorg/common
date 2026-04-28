import { matchingDomainOrganizations as getMatchingDomainOrganizations } from '@op/common';
import { z } from 'zod';

import { searchedOrganizationEncoder } from '../../encoders';
import { commonAuthedProcedure, router } from '../../trpcFactory';

export const matchingDomainOrganizations = router({
  listMatchingDomainOrganizations: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 100 },
  })
    .input(z.undefined())
    .output(z.array(searchedOrganizationEncoder))
    .query(async ({ ctx }) => {
      const result = await getMatchingDomainOrganizations({
        user: ctx.user,
      });

      // Domain matches are filtered server-side to exclude existing
      // memberships, so isMember is always false here.
      return result.map((org) =>
        searchedOrganizationEncoder.parse({ org, isMember: false }),
      );
    }),
});
