import { Channels, updateDecisionInstance } from '@op/common';

import {
  decisionProfileWithSchemaEncoder,
  updateDecisionInstanceInputSchema,
} from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const updateDecisionInstanceRouter = router({
  updateDecisionInstance: commonAuthedProcedure()
    .input(updateDecisionInstanceInputSchema)
    .output(decisionProfileWithSchemaEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const profile = await updateDecisionInstance({
        ...input,
        user,
      });

      ctx.registerMutationChannels([
        Channels.decisionInstance(input.instanceId),
      ]);

      return decisionProfileWithSchemaEncoder.parse(profile);
    }),
});
