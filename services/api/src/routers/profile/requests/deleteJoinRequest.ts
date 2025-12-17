import { deleteProfileJoinRequest } from '@op/common';
import { z } from 'zod';

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
    .mutation(async ({ input, ctx }) => {
      await deleteProfileJoinRequest({
        user: ctx.user,
        requestId: input.requestId,
      });
    }),
});
