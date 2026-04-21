import { getOrganizationsByProfile } from '@op/common';
import { z } from 'zod';

import { organizationsWithProfileEncoder } from '../../encoders/organizations';
import { commonAuthedProcedure, router } from '../../trpcFactory';

export const getOrganizationsByProfileRouter = router({
  getOrganizationsByProfile: commonAuthedProcedure()
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
