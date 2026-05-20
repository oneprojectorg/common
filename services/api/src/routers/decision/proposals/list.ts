import { Channels, listAllProposals, listProposals } from '@op/common';
import { allProposalsListSchema, proposalListSchema } from '@op/common/client';

import {
  allProposalsFilterSchema,
  proposalFilterSchema,
} from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const listProposalsRouter = router({
  listProposals: commonAuthedProcedure()
    .input(proposalFilterSchema)
    .output(proposalListSchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const result = await listProposals({
        input: { ...input, authUserId: user.id },
        user,
      });

      ctx.registerQueryChannels([
        Channels.decisionProposals(input.processInstanceId),
      ]);

      return proposalListSchema.parse(result);
    }),
  listAllProposals: commonAuthedProcedure()
    .input(allProposalsFilterSchema)
    .output(allProposalsListSchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const result = await listAllProposals({
        input: { ...input, authUserId: user.id },
        user,
      });

      ctx.registerQueryChannels([
        Channels.decisionProposals(input.processInstanceId),
      ]);

      return allProposalsListSchema.parse(result);
    }),
});
