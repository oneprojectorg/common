import { Channels, listDevelopOrigins } from '@op/common';
import {
  listDevelopOriginsInputSchema,
  developOriginListSchema,
} from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listDevelopOriginsRouter = router({
  /**
   * The proposals of the phase before the current develop phase that the
   * caller may develop into entries: those assigned to the caller by default,
   * every one for an admin who asks for `all`. Each page carries the
   * caller's own entry for its origins that have one.
   */
  listDevelopOrigins: networkAuthenticatedProcedure()
    .input(listDevelopOriginsInputSchema)
    .output(developOriginListSchema)
    .query(async ({ ctx, input }) => {
      const result = await listDevelopOrigins({ input, user: ctx.user });

      ctx.registerQueryChannels([
        Channels.decisionProposals(input.processInstanceId),
      ]);

      return developOriginListSchema.parse(result);
    }),
});
