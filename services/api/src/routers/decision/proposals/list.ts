import { Channels, listAllProposals, listProposals } from '@op/common';
import {
  allProposalsFilterSchema,
  allProposalsListSchema,
  proposalListSchema,
} from '@op/common/client';

import { proposalFilterSchema } from '../../../encoders/decision';
import {
  commonAuthedProcedure,
  commonOpenProcedure,
  router,
} from '../../../trpcFactory';

export const listProposalsRouter = router({
  /** Lists proposals for a given process instanc in the curent phase. */
  listProposals: commonOpenProcedure()
    .input(proposalFilterSchema)
    .output(proposalListSchema)
    .query(async ({ ctx, input }) => {
      const { user, accessUser } = ctx.authContext;
      const result = await listProposals({
        input,
        user,
        accessUser,
      });

      ctx.registerQueryChannels([
        Channels.decisionProposals(input.processInstanceId),
      ]);

      return proposalListSchema.parse(result);
    }),
  /** Lists all proposals for a given process instance, no phase filter. */
  listAllProposals: commonAuthedProcedure()
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
      ]);

      return allProposalsListSchema.parse(result);
    }),
});
