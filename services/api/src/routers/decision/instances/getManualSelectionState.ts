import { Channels, getManualSelectionState, listProposals } from '@op/common';
import { proposalSchema } from '@op/common/client';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

const getManualSelectionStateInputSchema = z.object({
  processInstanceId: z.uuid(),
  categoryId: z.uuid().optional(),
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

      // TODO: the service already fetched full candidate rows; we throw them
      // away here and re-fetch via listProposals only to enrich them with
      // submitter/profile data. Consolidate so the service returns enriched
      // proposals directly and drop this second round-trip.
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
