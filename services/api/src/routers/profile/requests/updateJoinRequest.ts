import { updateProfileJoinRequest } from '@op/common';
import { JoinProfileRequestStatus } from '@op/db/schema';
import { z } from 'zod';

import { joinProfileRequestEncoder } from '../../../encoders/joinProfileRequests';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import withRateLimited from '../../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../../trpcFactory';

const inputSchema = z.object({
  /** The ID of the join profile request to update */
  requestId: z.uuid(),
  /** New status for the request */
  status: z.enum([
    JoinProfileRequestStatus.APPROVED,
    JoinProfileRequestStatus.REJECTED,
  ]),
});

export const updateJoinRequestRouter = router({
  updateJoinRequest: loggedProcedure
    .use(withRateLimited({ windowSize: 60, maxRequests: 10 }))
    .use(withAuthenticated)
    .input(inputSchema)
    .output(joinProfileRequestEncoder)
    .mutation(async ({ input, ctx }) => {
      const result = await updateProfileJoinRequest({
        user: ctx.user,
        requestId: input.requestId,
        status: input.status,
      });

      return joinProfileRequestEncoder.parse(result);
    }),
});
