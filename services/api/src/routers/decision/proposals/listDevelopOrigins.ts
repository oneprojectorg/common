import { Channels, listDevelopOrigins } from '@op/common';
import {
  developOriginListSchema,
  listDevelopOriginsInputSchema,
} from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listDevelopOriginsRouter = router({
  /** The earlier-phase proposals a developed entry can be made from. */
  listDevelopOrigins: networkAuthenticatedProcedure()
    .input(listDevelopOriginsInputSchema)
    .output(developOriginListSchema)
    .query(async ({ ctx, input }) => {
      ctx.registerQueryChannels([
        Channels.decisionProposals(input.processInstanceId),
        // An assigned list changes when the caller's assignments do.
        ...(input.scope === 'assigned'
          ? [Channels.reviewAssignments(input.processInstanceId)]
          : []),
      ]);

      return await listDevelopOrigins({ ...input, user: ctx.user });
    }),
});
