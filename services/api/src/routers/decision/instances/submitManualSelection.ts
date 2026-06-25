import { invalidateMultiple } from '@op/cache';
import { Channels, submitManualSelection } from '@op/common';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { authenticatedConfirmedProcedure, router } from '../../../trpcFactory';
import { trackManualSelectionSubmitted } from '../../../utils/analytics';

const submitManualSelectionInputSchema = z.object({
  processInstanceId: z.uuid(),
  proposalIds: z.array(z.uuid()).min(1),
});

export const submitManualSelectionRouter = router({
  submitManualSelection: authenticatedConfirmedProcedure()
    .input(submitManualSelectionInputSchema)
    .mutation(async ({ ctx, input }) => {
      await submitManualSelection({
        processInstanceId: input.processInstanceId,
        proposalIds: input.proposalIds,
        user: ctx.user,
      });

      // Drop the writer's own cached projections; other viewers' per-caller
      // entries TTL out.
      waitUntil(
        invalidateMultiple({
          type: 'decision',
          paramsList: [
            [input.processInstanceId, ctx.user.id, 'instance'],
            [input.processInstanceId, ctx.user.id, 'categories'],
          ],
        }),
      );

      ctx.registerMutationChannels([
        Channels.decisionInstance(input.processInstanceId),
      ]);

      waitUntil(
        trackManualSelectionSubmitted(ctx, input.processInstanceId, {
          proposal_count: input.proposalIds.length,
        }),
      );
    }),
});
