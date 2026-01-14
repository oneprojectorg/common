import { Channels, deleteProfileJoinRequest } from '@op/common';
import { z } from 'zod';

import { joinProfileRequestEncoder } from '../../../encoders/joinProfileRequests';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

const inputSchema = z.object({
  /** The ID of the join profile request to delete */
  requestId: z.uuid(),
});

export const deleteJoinRequestRouter = router({
  deleteJoinRequest: commonAuthedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 10 },
  })
    .input(inputSchema)
    .output(joinProfileRequestEncoder)
    .mutation(async ({ input, ctx }) => {
      const result = await deleteProfileJoinRequest({
        user: ctx.user,
        requestId: input.requestId,
      });

      ctx.registerMutationChannels([
        Channels.profileJoinRequest({
          profileId: result.requestProfile.id,
          type: 'source',
        }),
        Channels.profileJoinRequest({
          profileId: result.targetProfile.id,
          type: 'target',
        }),
      ]);

      return joinProfileRequestEncoder.parse(result);
    }),
});
