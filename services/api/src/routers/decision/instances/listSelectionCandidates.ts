import { Channels, listSelectionCandidates } from '@op/common';
import { proposalSchema } from '@op/common/client';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

const listSelectionCandidatesInputSchema = z.object({
  processInstanceId: z.uuid(),
  categoryId: z.uuid().optional(),
  sortOrder: z.enum(['newest', 'oldest']).default('newest'),
});

const listSelectionCandidatesOutputSchema = z.object({
  proposals: z.array(proposalSchema),
});

export const listSelectionCandidatesRouter = router({
  listSelectionCandidates: commonAuthedProcedure()
    .input(listSelectionCandidatesInputSchema)
    .output(listSelectionCandidatesOutputSchema)
    .query(async ({ ctx, input }) => {
      ctx.registerQueryChannels([
        Channels.decisionInstance(input.processInstanceId),
      ]);

      return listSelectionCandidates({
        processInstanceId: input.processInstanceId,
        categoryId: input.categoryId,
        sortOrder: input.sortOrder,
        user: ctx.user,
      });
    }),
});
