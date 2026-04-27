import {
  Channels,
  hydrateProposalsWithReviewAggregates,
  hydrateProposalsWithReviewAggregatesInputSchema,
  listProposalsWithReviewAggregates,
  listProposalsWithReviewAggregatesInputSchema,
  proposalsWithReviewAggregatesListSchema,
} from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const listWithReviewAggregatesRouter = router({
  listWithReviewAggregates: commonAuthedProcedure()
    .input(
      z.union([
        hydrateProposalsWithReviewAggregatesInputSchema,
        listProposalsWithReviewAggregatesInputSchema,
      ]),
    )
    .output(proposalsWithReviewAggregatesListSchema)
    .query(async ({ ctx, input }) => {
      ctx.registerQueryChannels([
        Channels.reviewAssignments(input.processInstanceId),
      ]);

      if ('proposalIds' in input) {
        return await hydrateProposalsWithReviewAggregates({
          ...input,
          user: ctx.user,
        });
      }

      return await listProposalsWithReviewAggregates({
        ...input,
        user: ctx.user,
      });
    }),
});
