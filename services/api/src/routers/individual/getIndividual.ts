import {
  NotFoundError,
  getIndividualTerms,
  getIndividualTermsByProfile,
} from '@op/common';
import { z } from 'zod';

import { individualsTermsEncoder } from '../../encoders/individuals';
import { commonAuthedProcedure, router } from '../../trpcFactory';

export const getIndividualRouter = router({
  getTerms: commonAuthedProcedure()
    .input(z.object({ id: z.string(), termUri: z.string().optional() }))
    .output(individualsTermsEncoder)
    .query(async ({ input }) => {
      const result = await getIndividualTerms({
        individualId: input.id,
      });

      if (!result) {
        throw new NotFoundError('Individual terms');
      }

      return individualsTermsEncoder.parse(result);
    }),
  getTermsByProfile: commonAuthedProcedure()
    .input(z.object({ profileId: z.string(), termUri: z.string().optional() }))
    .output(individualsTermsEncoder)
    .query(async ({ input }) => {
      const result = await getIndividualTermsByProfile({
        profileId: input.profileId,
      });

      return individualsTermsEncoder.parse(result);
    }),
});
