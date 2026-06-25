import {
  Channels,
  invalidateDecisionInstance,
  submitManualSelection,
} from '@op/common';
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

      waitUntil(invalidateDecisionInstance(input.processInstanceId));

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
