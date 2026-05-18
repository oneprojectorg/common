import { trackPhaseEndDateChanged } from '@op/analytics';
import { Channels, updateDecisionInstance } from '@op/common';
import { waitUntil } from '@vercel/functions';

import {
  decisionProfileWithSchemaEncoder,
  updateDecisionInstanceInputSchema,
} from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';
import {
  trackAdminSetProcess,
  trackAdminSetRubric,
} from '../../../utils/analytics';

export const updateDecisionInstanceRouter = router({
  updateDecisionInstance: commonAuthedProcedure()
    .input(updateDecisionInstanceInputSchema)
    .output(decisionProfileWithSchemaEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const { profile, phaseEndDateChanges, isBeingPublished } =
        await updateDecisionInstance({
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

      if (isBeingPublished) {
        waitUntil(trackAdminSetProcess(ctx, input.instanceId));
      }

      if (input.rubricTemplate !== undefined) {
        waitUntil(trackAdminSetRubric(ctx, input.instanceId));
      }

      return decisionProfileWithSchemaEncoder.parse(profile);
    }),
});
