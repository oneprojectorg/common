import { Channels, createJoinProfileRequest } from '@op/common';
import { z } from 'zod';

import { joinProfileRequestEncoder } from '../../../encoders/joinProfileRequests';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import withRateLimited from '../../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../../trpcFactory';

const inputSchema = z.object({
  /** The profile ID of the requester */
  requestProfileId: z.uuid(),
  /** The profile ID of the target to join */
  targetProfileId: z.uuid(),
});

export const createJoinRequestRouter = router({
  createJoinRequest: loggedProcedure
    .use(withRateLimited({ windowSize: 60, maxRequests: 10 }))
    .use(withAuthenticated)
    .input(inputSchema)
    .output(joinProfileRequestEncoder)
    .mutation(async ({ input, ctx }) => {
      const result = await createJoinProfileRequest({
        requestProfileId: input.requestProfileId,
        targetProfileId: input.targetProfileId,
        user: ctx.user,
      });

      ctx.setChannels('mutation', [
        Channels.profile.joinRequest({
          profileId: result.requestProfileId,
          type: 'source',
        }),
        Channels.profile.joinRequest({
          profileId: result.targetProfileId,
          type: 'target',
        }),
      ]);

      return joinProfileRequestEncoder.parse(result);
    }),
});
