import { Channels, getProfileJoinRequest } from '@op/common';
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

export const getJoinRequestRouter = router({
  getJoinRequest: loggedProcedure
    .use(withRateLimited({ windowSize: 60, maxRequests: 60 }))
    .use(withAuthenticated)
    .input(inputSchema)
    .output(joinProfileRequestEncoder.nullable())
    .query(async ({ input, ctx }) => {
      const result = await getProfileJoinRequest({
        user: ctx.user,
        requestProfileId: input.requestProfileId,
        targetProfileId: input.targetProfileId,
      });

      ctx.setQueryChannels([
        Channels.profileJoinRequest({
          type: 'source',
          profileId: input.requestProfileId,
        }),
        Channels.profileJoinRequest({
          type: 'target',
          profileId: input.targetProfileId,
        }),
      ]);

      if (!result) {
        return null;
      }

      return joinProfileRequestEncoder.parse(result);
    }),
});
