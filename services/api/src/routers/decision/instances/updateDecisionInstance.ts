import { updateDecisionInstance } from '@op/common';

import {
  decisionProfileEncoder,
  updateDecisionInstanceInputSchema,
} from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const updateDecisionInstanceRouter = router({
  updateDecisionInstance: commonAuthedProcedure()
    .input(updateDecisionInstanceInputSchema)
    .output(decisionProfileEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const profile = await updateDecisionInstance({
        ...input,
        user,
      });

      return decisionProfileEncoder.parse(profile);
    }),
});
