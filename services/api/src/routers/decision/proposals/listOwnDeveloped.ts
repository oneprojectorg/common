import { Channels, listOwnDevelopedProposals } from '@op/common';
import {
  listOwnDevelopedProposalsInputSchema,
  ownDevelopedProposalListSchema,
} from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listOwnDevelopedProposalsRouter = router({
  /**
   * One page of the caller's own developed proposals (drafts included) in the
   * current phase, each with the proposals it was developed from, plus the
   * counts and budget total of every entry the search matches.
   */
  listOwnDevelopedProposals: networkAuthenticatedProcedure()
    .input(listOwnDevelopedProposalsInputSchema)
    .output(ownDevelopedProposalListSchema)
    .query(async ({ ctx, input }) => {
      const result = await listOwnDevelopedProposals({
        ...input,
        user: ctx.user,
      });

      // Create and submit of a developed proposal register this channel.
      ctx.registerQueryChannels([
        Channels.decisionProposals(input.processInstanceId),
      ]);

      return result;
    }),
});
