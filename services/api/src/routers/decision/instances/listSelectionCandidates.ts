import { Channels, listSelectionCandidates } from '@op/common';
import { list, proposalSchema } from '@op/common/client';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

const listSelectionCandidatesInputSchema = z.object({
  processInstanceId: z.uuid(),
  categoryId: z.uuid().optional(),
  sortOrder: z.enum(['votes', 'newest', 'oldest']).default('votes'),
});

const listSelectionCandidatesOutputSchema = list(proposalSchema).extend({
  totalCandidates: z.number().int().nonnegative(),
});

export const listSelectionCandidatesRouter = router({
  listSelectionCandidates: networkAuthenticatedProcedure()
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
