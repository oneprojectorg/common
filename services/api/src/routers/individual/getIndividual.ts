import { getIndividualTermsByProfile } from '@op/common';
import { z } from 'zod';

import { individualsTermsEncoder } from '../../encoders/individuals';
import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

export const getIndividualRouter = router({
  getTermsByProfile: networkAuthenticatedProcedure()
    .input(z.object({ profileId: z.string(), termUri: z.string().optional() }))
    .output(individualsTermsEncoder)
    .query(async ({ input }) => {
      const result = await getIndividualTermsByProfile({
        profileId: input.profileId,
      });

      return individualsTermsEncoder.parse(result);
    }),
});
