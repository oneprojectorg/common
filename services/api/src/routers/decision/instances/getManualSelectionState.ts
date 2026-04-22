import { Channels, getManualSelectionState, listProposals } from '@op/common';
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
      const state = await getManualSelectionState({
        processInstanceId: input.processInstanceId,
        categoryId: input.categoryId,
        user: ctx.user,
      });

      ctx.registerQueryChannels([
        Channels.decisionInstance(input.processInstanceId),
      ]);

      // TODO: have the service return enriched proposals to drop this re-fetch.
      const enrichedProposals =
        state.candidates.length === 0
          ? []
          : (
              await listProposals({
                input: {
                  processInstanceId: input.processInstanceId,
                  proposalIds: state.candidates.map((c) => c.id),
                  authUserId: ctx.user.id,
                  limit: state.candidates.length,
                  orderBy: 'createdAt',
                  dir: input.sortOrder === 'oldest' ? 'asc' : 'desc',
                },
                user: ctx.user,
              })
            ).proposals;

      return {
        selectionsConfirmed: state.selectionsConfirmed,
        proposals: enrichedProposals,
      };
    }),
});
