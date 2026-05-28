import { Channels, createProfileJoinRequest } from '@op/common';
import { z } from 'zod';

import { joinProfileRequestEncoder } from '../../../encoders/joinProfileRequests';
import { commonNetworkProcedure, router } from '../../../trpcFactory';

const inputSchema = z.object({
  /** The profile ID of the requester */
  requestProfileId: z.uuid(),
  /** The profile ID of the target to join */
  targetProfileId: z.uuid(),
});

export const createJoinRequestRouter = router({
  createJoinRequest: commonNetworkProcedure({
    rateLimit: { windowSize: 60, maxRequests: 10 },
  })
    .input(inputSchema)
    .output(joinProfileRequestEncoder)
    .mutation(async ({ input, ctx }) => {
      const result = await createProfileJoinRequest({
        requestProfileId: input.requestProfileId,
        targetProfileId: input.targetProfileId,
        user: ctx.user,
      });

      ctx.registerMutationChannels([
        Channels.profileJoinRequest({
          type: 'source',
          profileId: result.requestProfileId,
        }),
        Channels.profileJoinRequest({
          type: 'target',
          profileId: result.targetProfileId,
        }),
      ]);

      return joinProfileRequestEncoder.parse(result);
    }),
});
