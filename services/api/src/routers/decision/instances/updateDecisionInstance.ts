import { trackPhaseEndDateChanged } from '@op/analytics';
import { invalidateMultiple } from '@op/cache';
import { Channels, updateDecisionInstance } from '@op/common';
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

      // Drop the writer's own cached instance + categories projections so the
      // next refetch sees fresh data. Other viewers' per-caller entries TTL out.
      waitUntil(
        invalidateMultiple({
          type: 'decision',
          paramsList: [
            [input.instanceId, user.id, 'instance'],
            [input.instanceId, user.id, 'categories'],
          ],
        }),
      );

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
