import { Channels, publishDecisionInstance } from '@op/common';
import { ProcessStatus } from '@op/db/schema';
import { z } from 'zod';

import { decisionProfileWithSchemaEncoder } from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const publishDecisionInstanceRouter = router({
  publishDecisionInstance: commonAuthedProcedure()
    .input(
      z.object({
        instanceId: z.uuid(),
        status: z.enum(ProcessStatus).optional(),
      }),
    )
    .output(decisionProfileWithSchemaEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const profile = await publishDecisionInstance({
        ...input,
        user,
      });

      ctx.registerMutationChannels([
        Channels.decisionInstance(input.instanceId),
      ]);

      return decisionProfileWithSchemaEncoder.parse(profile);
    }),
});
