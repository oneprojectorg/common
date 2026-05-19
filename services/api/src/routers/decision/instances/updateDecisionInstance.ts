import { trackPhaseEndDateChanged } from '@op/analytics';
import { Channels, updateDecisionInstance } from '@op/common';
import { waitUntil } from '@vercel/functions';

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

      const { profile, phaseEndDateChanges } = await updateDecisionInstance({
        ...input,
        user,
      });

      ctx.registerMutationChannels([
        Channels.decisionInstance(input.instanceId),
      ]);

      for (const change of phaseEndDateChanges) {
        waitUntil(
          trackPhaseEndDateChanged(ctx.user.id, input.instanceId, {
            phase_id: change.phaseId,
            previous_end_date: change.previousEndDate,
            new_end_date: change.newEndDate,
          }),
        );
      }

      return decisionProfileWithSchemaEncoder.parse(profile);
    }),
});
