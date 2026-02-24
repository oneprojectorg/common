import { deleteInstance as deleteInstanceService } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const deleteInstanceRouter = router({
  deleteInstance: commonAuthedProcedure()
    .input(
      z.object({
        instanceId: z.string().uuid(),
      }),
    )
    .output(
      z.object({
        success: z.boolean(),
        action: z.enum(['deleted', 'cancelled']),
        instanceId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      return deleteInstanceService({
        instanceId: input.instanceId,
        user,
      });
    }),
});
