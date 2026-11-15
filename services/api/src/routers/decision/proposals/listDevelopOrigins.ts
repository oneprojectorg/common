import { Channels, listDevelopOrigins } from '@op/common';
import {
  listDevelopOriginsInputSchema,
  proposalListSchema,
} from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listDevelopOriginsRouter = router({
  /**
   * The proposals of the phase before the current develop phase that the
   * caller may develop into entries: those assigned to the caller by default,
   * every one for an admin who asks for `all`.
   */
  listDevelopOrigins: networkAuthenticatedProcedure()
    .input(listDevelopOriginsInputSchema)
    .output(proposalListSchema)
    .query(async ({ ctx, input }) => {
      const result = await listDevelopOrigins({ input, user: ctx.user });

      ctx.registerQueryChannels([
        Channels.decisionProposals(input.processInstanceId),
      ]);

      return proposalListSchema.parse(result);
    }),
});
