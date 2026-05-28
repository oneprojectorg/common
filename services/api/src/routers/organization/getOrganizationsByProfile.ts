import { getOrganizationsByProfile } from '@op/common';
import { z } from 'zod';

import { organizationsWithProfileEncoder } from '../../encoders/organizations';
import { commonNetworkProcedure, router } from '../../trpcFactory';

export const getOrganizationsByProfileRouter = router({
  getOrganizationsByProfile: commonNetworkProcedure()
    .input(z.object({ profileId: z.uuid() }))
    .output(z.array(organizationsWithProfileEncoder))
    .query(async ({ input }) => {
      const { profileId } = input;

      const organizations = await getOrganizationsByProfile(profileId);

      return organizations.map((org) =>
        organizationsWithProfileEncoder.parse(org),
      );
    }),
});
