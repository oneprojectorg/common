import { deleteAccount } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const outputSchema = z.object({
  deletedId: z.string(),
});

export const deleteAccountRouter = router({
  deleteAccount: commonAuthedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 3 },
  })
    .input(z.undefined())
    .output(outputSchema)
    .mutation(({ ctx }) => deleteAccount({ user: ctx.user })),
});
