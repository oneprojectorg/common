import { Channels, getCategoryDevelopmentState } from '@op/common';
import {
  categoryReviewerStatusInputSchema,
  categoryDevelopmentStateSchema,
} from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const getCategoryDevelopmentStateRouter = router({
  getCategoryDevelopmentState: networkAuthenticatedProcedure()
    .input(categoryReviewerStatusInputSchema)
    .output(categoryDevelopmentStateSchema)
    .query(async ({ ctx, input }) => {
      const state = await getCategoryDevelopmentState({
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
