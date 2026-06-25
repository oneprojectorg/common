import { invalidateMultiple } from '@op/cache';
import { Channels, triggerPhaseAdvancement } from '@op/common';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { authenticatedConfirmedProcedure, router } from '../../../trpcFactory';
import { trackManualTransitionConfirmed } from '../../../utils/analytics';

export const transitionFromPhaseRouter = router({
  transitionFromPhase: authenticatedConfirmedProcedure()
    .input(
      z.object({
        instanceId: z.uuid(),
        fromPhaseId: z.string().min(1).optional(),
      }),
    )
    .output(
      z.object({
        currentPhaseId: z.string(),
        previousPhaseId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await triggerPhaseAdvancement({
        instanceId: input.instanceId,
        fromPhaseId: input.fromPhaseId,
        user: ctx.user,
      });

      // Drop the writer's own cached projections; other viewers' per-caller
      // entries TTL out.
      waitUntil(
        invalidateMultiple({
          type: 'decision',
          paramsList: [
            [input.instanceId, ctx.user.id, 'instance'],
            [input.instanceId, ctx.user.id, 'categories'],
          ],
        }),
      );

      ctx.registerMutationChannels([
        Channels.decisionInstance(input.instanceId),
      ]);

      waitUntil(
        trackManualTransitionConfirmed(ctx, input.instanceId, {
          from_phase_id: result.previousPhaseId,
          to_phase_id: result.currentPhaseId,
        }),
      );

      return result;
    }),
});
