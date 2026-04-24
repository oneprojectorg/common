import { Channels, submitManualSelection } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

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
    }),
});
