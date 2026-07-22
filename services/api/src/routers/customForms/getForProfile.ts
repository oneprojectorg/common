import { getCustomFormForProfile } from '@op/common';
import { getCustomFormForProfileInputSchema } from '@op/common/client';

import { customFormEncoder } from '../../encoders';
import { authenticatedProcedure, router } from '../../trpcFactory';

export const getForProfile = router({
  // Authenticated (matching the submit tier): form definitions are only
  // needed inside the logged-in proposal flow, so there is no reason to
  // let anonymous callers enumerate profile UUIDs for form contents.
  getForProfile: authenticatedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 100 },
  })
    .input(getCustomFormForProfileInputSchema)
    .output(customFormEncoder.nullable())
    .query(async ({ input }) => {
      const form = await getCustomFormForProfile({
        profileId: input.profileId,
        phaseId: input.phaseId,
        initialPhaseId: input.initialPhaseId,
      });

      return form ? customFormEncoder.parse(form) : null;
    }),
});
