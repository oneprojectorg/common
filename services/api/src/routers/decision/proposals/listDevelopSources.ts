import { Channels, listDevelopSources } from '@op/common';
import {
  developSourceListSchema,
  listDevelopSourcesInputSchema,
} from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listDevelopSourcesRouter = router({
  listDevelopSources: networkAuthenticatedProcedure()
    .input(listDevelopSourcesInputSchema)
    .output(developSourceListSchema)
    .query(async ({ ctx, input }) => {
      ctx.registerQueryChannels([
        Channels.decisionProposals(input.processInstanceId),
        ...(input.scope === 'assigned'
          ? [Channels.reviewAssignments(input.processInstanceId)]
          : []),
      ]);

      return await listDevelopSources({ ...input, user: ctx.user });
    }),
});
