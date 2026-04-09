import { Channels, promoteSourceToLive } from '@op/common';
import { ProcessStatus } from '@op/db/schema';
import { z } from 'zod';

import { decisionProfileWithSchemaEncoder } from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const promoteSourceToLiveRouter = router({
  promoteSourceToLive: commonAuthedProcedure()
    .input(
      z.object({
        instanceId: z.uuid(),
        status: z.enum(ProcessStatus).optional(),
      }),
    )
    .output(decisionProfileWithSchemaEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const profile = await promoteSourceToLive({
        ...input,
        user,
      });

      ctx.registerMutationChannels([
        Channels.decisionInstance(input.instanceId),
      ]);

      return decisionProfileWithSchemaEncoder.parse(profile);
    }),
});
