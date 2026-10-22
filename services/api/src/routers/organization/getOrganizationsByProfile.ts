import { getOrganizationsByProfile } from '@op/common';
import { list } from '@op/common/client';
import { z } from 'zod';

import { organizationsWithProfileEncoder } from '../../encoders/organizations';
import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

export const getOrganizationsByProfileRouter = router({
  getOrganizationsByProfile: networkAuthenticatedProcedure()
    .input(z.object({ profileId: z.uuid() }))
    .output(list(organizationsWithProfileEncoder))
    .query(async ({ input }) => {
      const { profileId } = input;

      const organizations = await getOrganizationsByProfile(profileId);

      return {
        items: organizations.map((org) =>
          organizationsWithProfileEncoder.parse(org),
        ),
      };
    }),
});
