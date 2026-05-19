import { Channels, listAllProposals, listProposals } from '@op/common';
import { proposalListSchema } from '@op/common/client';

import { proposalFilterSchema } from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const listProposalsRouter = router({
  listProposals: commonAuthedProcedure()
    .input(proposalFilterSchema)
    .output(proposalListSchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { scope, phaseId, ...base } = input;
      const baseInput = { ...base, authUserId: user.id };

      const result =
        scope === 'all'
          ? await listAllProposals({ input: baseInput, user })
          : await listProposals({ input: { ...baseInput, phaseId }, user });

      ctx.registerQueryChannels([
        Channels.decisionProposals(input.processInstanceId),
      ]);

      return proposalListSchema.parse(result);
    }),
});
