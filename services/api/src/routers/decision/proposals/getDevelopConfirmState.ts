import { Channels, getDevelopConfirmState } from '@op/common';
import {
  categoryReviewerStatusInputSchema,
  developConfirmStateSchema,
} from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const getDevelopConfirmStateRouter = router({
  getDevelopConfirmState: networkAuthenticatedProcedure()
    .input(categoryReviewerStatusInputSchema)
    .output(developConfirmStateSchema)
    .query(async ({ ctx, input }) => {
      const state = await getDevelopConfirmState({
        processInstanceId: input.processInstanceId,
        user: ctx.user,
      });

      // Confirm and unconfirm publish on the proposals channel; a phase
      // change or a confirmed selection, which close the window, on the
      // instance channel.
      ctx.registerQueryChannels([
        Channels.decisionProposals(input.processInstanceId),
        Channels.decisionInstance(input.processInstanceId),
      ]);

      return state;
    }),
});
