import { Channels, listVoters, votersListSchema } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

const listVotersInputSchema = z.object({
  processInstanceId: z.uuid(),
});

export const listVotersRouter = router({
  listVoters: networkAuthenticatedProcedure()
    .input(listVotersInputSchema)
    .output(votersListSchema)
    .query(({ ctx, input }) => {
      ctx.registerQueryChannels([
        Channels.decisionVoters(input.processInstanceId),
      ]);

      return listVoters({
        processInstanceId: input.processInstanceId,
        user: ctx.user,
      });
    }),
});
