import { Channels, getManualSelectionState } from '@op/common';
import { proposalSchema } from '@op/common/client';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

const getManualSelectionStateInputSchema = z.object({
  processInstanceId: z.uuid(),
  categoryId: z.uuid().optional(),
  sortOrder: z.enum(['newest', 'oldest']).default('newest'),
});

const getManualSelectionStateOutputSchema = z.object({
  selectionsConfirmed: z.boolean(),
  proposals: z.array(proposalSchema),
});

export const getManualSelectionStateRouter = router({
  getManualSelectionState: commonAuthedProcedure()
    .input(getManualSelectionStateInputSchema)
    .output(getManualSelectionStateOutputSchema)
    .query(async ({ ctx, input }) => {
      ctx.registerQueryChannels([
        Channels.decisionInstance(input.processInstanceId),
      ]);

      return getManualSelectionState({
        processInstanceId: input.processInstanceId,
        categoryId: input.categoryId,
        sortOrder: input.sortOrder,
        user: ctx.user,
      });
    }),
});
