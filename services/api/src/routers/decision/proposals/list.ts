import {
  Channels,
  getProposalLikesChannels,
  listAllProposals,
  listProposals,
} from '@op/common';
import {
  allProposalsFilterSchema,
  allProposalsListSchema,
  proposalListSchema,
} from '@op/common/client';

import { proposalFilterSchema } from '../../../encoders/decision';
import { openProcedure, router } from '../../../trpcFactory';

export const listProposalsRouter = router({
  /** Lists proposals for a given process instance in the current phase. */
  listProposals: openProcedure({
    rateLimit: { windowSize: 10, maxRequests: 100 },
  })
    .input(proposalFilterSchema)
    .output(proposalListSchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const result = await listProposals({
        input,
        user,
      });

      ctx.registerQueryChannels([
        Channels.decisionProposals(input.processInstanceId),
        ...getProposalLikesChannels({
          processInstanceId: input.processInstanceId,
          profileId: input.likedByProfileId,
        }),
      ]);

      return proposalListSchema.parse(result);
    }),
  /** Lists all proposals for a given process instance, no phase filter. */
  listAllProposals: openProcedure({
    rateLimit: { windowSize: 10, maxRequests: 100 },
  })
    .input(allProposalsFilterSchema)
    .output(allProposalsListSchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const result = await listAllProposals({
        input,
        user,
      });

      ctx.registerQueryChannels([
        Channels.decisionProposals(input.processInstanceId),
        ...getProposalLikesChannels({
          processInstanceId: input.processInstanceId,
          profileId: input.likedByProfileId,
        }),
      ]);

      return allProposalsListSchema.parse(result);
    }),
});
