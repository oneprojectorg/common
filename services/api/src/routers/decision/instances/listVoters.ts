import { Channels, listVoters, votersListSchema } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

const listVotersInputSchema = z.object({
  processInstanceId: z.uuid(),
});

export const listVotersRouter = router({
  listVoters: commonAuthedProcedure()
    .input(listVotersInputSchema)
    .output(votersListSchema)
    .query(({ ctx, input }) => {
      ctx.registerQueryChannels([
        Channels.decisionInstance(input.processInstanceId),
      ]);

      return listVoters({ input, user: ctx.user });
    }),
});
