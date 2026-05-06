import { Channels, submitManualSelection } from '@op/common';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';
import { trackManualSelectionSubmitted } from '../../../utils/analytics';

const submitManualSelectionInputSchema = z.object({
  processInstanceId: z.uuid(),
  proposalIds: z.array(z.uuid()).min(1),
});

export const submitManualSelectionRouter = router({
  submitManualSelection: commonAuthedProcedure()
    .input(submitManualSelectionInputSchema)
    .mutation(async ({ ctx, input }) => {
      await submitManualSelection({
        processInstanceId: input.processInstanceId,
        proposalIds: input.proposalIds,
        user: ctx.user,
      });

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
