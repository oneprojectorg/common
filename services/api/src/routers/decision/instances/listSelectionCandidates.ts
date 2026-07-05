import { Channels, listSelectionCandidates } from '@op/common';
import {
  selectionCandidatesFilterSchema,
  selectionCandidatesListSchema,
} from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listSelectionCandidatesRouter = router({
  listSelectionCandidates: networkAuthenticatedProcedure()
    .input(selectionCandidatesFilterSchema)
    .output(selectionCandidatesListSchema)
    .query(async ({ ctx, input }) => {
      ctx.registerQueryChannels([
        Channels.decisionInstance(input.processInstanceId),
      ]);

      return listSelectionCandidates({
        processInstanceId: input.processInstanceId,
        categoryId: input.categoryId,
        sortOrder: input.sortOrder,
        limit: input.limit,
        user: ctx.user,
      });
    }),
});
