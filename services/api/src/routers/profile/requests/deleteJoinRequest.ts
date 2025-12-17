import { Channels, deleteProfileJoinRequest } from '@op/common';
import { z } from 'zod';

import { joinProfileRequestEncoder } from '../../../encoders/joinProfileRequests';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import withRateLimited from '../../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../../trpcFactory';

const inputSchema = z.object({
  /** The ID of the join profile request to delete */
  requestId: z.uuid(),
});

export const deleteJoinRequestRouter = router({
  deleteJoinRequest: loggedProcedure
    .use(withRateLimited({ windowSize: 60, maxRequests: 10 }))
    .use(withAuthenticated)
    .input(inputSchema)
    .output(joinProfileRequestEncoder)
    .mutation(async ({ input, ctx }) => {
      const result = await deleteProfileJoinRequest({
        user: ctx.user,
        requestId: input.requestId,
      });

      ctx.setChannels('mutation', [
        Channels.profile.joinRequest({
          profileId: result.requestProfile.id,
          type: 'source',
        }),
        Channels.profile.joinRequest({
          profileId: result.targetProfile.id,
          type: 'target',
        }),
      ]);

      return joinProfileRequestEncoder.parse(result);
    }),
});
