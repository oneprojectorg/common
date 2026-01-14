import { listDecisionProfiles } from '@op/common';

import {
  legacyDecisionProfileFilterSchema,
  legacyDecisionProfileListEncoder,
} from '../../../encoders/legacyDecision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const listDecisionProfilesRouter = router({
  listDecisionProfiles: commonAuthedProcedure()
    .input(legacyDecisionProfileFilterSchema)
    .output(legacyDecisionProfileListEncoder)
    .query(async ({ input, ctx }) => {
      const { user } = ctx;

      const result = await listDecisionProfiles({
        ...input,
        user,
      });

      return legacyDecisionProfileListEncoder.parse(result);
    }),
});
