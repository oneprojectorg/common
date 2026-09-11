import {
  Channels,
  getProposalWithReviewAggregates,
  getProposalWithReviewAggregatesInputSchema,
  proposalWithSubmittedReviewsSchema,
} from '@op/common';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const getProposalWithReviewAggregatesRouter = router({
  getProposalWithReviewAggregates: networkAuthenticatedProcedure()
    .input(getProposalWithReviewAggregatesInputSchema)
    .output(proposalWithSubmittedReviewsSchema)
    .query(async ({ ctx, input }) => {
      const result = await getProposalWithReviewAggregates({
        ...input,
        user: ctx.user,
      });

      ctx.registerQueryChannels([
        Channels.decisionProposal(input.processInstanceId, input.proposalId),
        Channels.reviewAssignments(input.processInstanceId),
      ]);

      return result;
    }),
});
