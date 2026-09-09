import { matchingDomainOrganizations as getMatchingDomainOrganizations } from '@op/common';
import { list } from '@op/common/client';
import { z } from 'zod';

import { searchedOrganizationEncoder } from '../../encoders';
import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

export const matchingDomainOrganizations = router({
  listMatchingDomainOrganizations: networkAuthenticatedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 100 },
  })
    .input(z.undefined())
    .output(list(searchedOrganizationEncoder))
    .query(async ({ ctx }) => {
      const result = await getMatchingDomainOrganizations({
        user: ctx.user,
      });

      // Domain matches are filtered server-side to exclude existing
      // memberships, so isMember is always false here.
      return {
        items: result.map((org) =>
          searchedOrganizationEncoder.parse({ org, isMember: false }),
        ),
      };
    }),
});
