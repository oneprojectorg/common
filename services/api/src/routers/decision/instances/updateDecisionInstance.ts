import { trackPhaseEndDateChanged } from '@op/analytics';
import {
  Channels,
  invalidateDecisionInstance,
  updateDecisionInstance,
} from '@op/common';
import { waitUntil } from '@vercel/functions';

import {
  decisionProfileWithSchemaEncoder,
  updateDecisionInstanceInputSchema,
} from '../../../encoders/decision';
import { authenticatedConfirmedProcedure, router } from '../../../trpcFactory';

export const updateDecisionInstanceRouter = router({
  updateDecisionInstance: authenticatedConfirmedProcedure()
    .input(updateDecisionInstanceInputSchema)
    .output(decisionProfileWithSchemaEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const { profile, phaseEndDateChanges } = await updateDecisionInstance({
        ...input,
        user,
      });

      waitUntil(invalidateDecisionInstance(input.instanceId));

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
