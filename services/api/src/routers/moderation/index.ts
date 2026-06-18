import { submitUserFlag } from '@op/common';
import { z } from 'zod';

import { openProcedure, router } from '../../trpcFactory';

const flagItemInputSchema = z.object({
  itemType: z.enum(['proposal', 'post', 'user']),
  itemId: z.uuid(),
  reason: z.string().max(1000).optional(),
});

const flagItemOutputSchema = z.object({
  flagId: z.uuid(),
});

export const moderationRouter = router({
  flagItem: openProcedure({
    rateLimit: { windowSize: 60, maxRequests: 5 },
  })
    .input(flagItemInputSchema)
    .output(flagItemOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const { flag } = await submitUserFlag({
        itemType: input.itemType,
        itemId: input.itemId,
        reason: input.reason,
        user: ctx.user,
      });

      return { flagId: flag.id };
    }),
});
