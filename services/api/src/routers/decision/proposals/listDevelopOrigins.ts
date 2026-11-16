import { Channels, listDevelopOrigins } from '@op/common';
import {
  developOriginListSchema,
  listDevelopOriginsInputSchema,
} from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listDevelopOriginsRouter = router({
  listDevelopOrigins: networkAuthenticatedProcedure()
    .input(listDevelopOriginsInputSchema)
    .output(developOriginListSchema)
    .query(async ({ ctx, input }) => {
      ctx.registerQueryChannels([
        Channels.decisionProposals(input.processInstanceId),
        ...(input.scope === 'assigned'
          ? [Channels.reviewAssignments(input.processInstanceId)]
          : []),
      ]);

      return await listDevelopOrigins({ ...input, user: ctx.user });
    }),
});
