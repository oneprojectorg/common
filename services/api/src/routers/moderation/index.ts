import {
  UnauthorizedError,
  getCurrentProfileId,
  submitUserFlag,
} from '@op/common';
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
  // A signed-in user reports an item. Records a pending flag and submits it for
  // async provider review; the provider's webhook confirms or clears it.
  // Tighter than the default rate limit: each call signs attachment URLs and
  // makes outbound provider submissions, and nobody legitimately reports five
  // items in a minute.
  flagItem: openProcedure({
    rateLimit: { windowSize: 60, maxRequests: 5 },
  })
    .input(flagItemInputSchema)
    .output(flagItemOutputSchema)
    .mutation(async ({ ctx, input }) => {
      // openProcedure resolves an optional user; reporting records the reporter
      // and ships the item's content to the provider, so fail closed without a
      // session rather than letting an anonymous caller flag content.
      if (!ctx.user) {
        throw new UnauthorizedError('Must be signed in to report content');
      }

      const flaggedByProfileId = await getCurrentProfileId(ctx.user.id);

      const { flag } = await submitUserFlag({
        itemType: input.itemType,
        itemId: input.itemId,
        flaggedByProfileId,
        reason: input.reason,
        user: ctx.user,
      });

      return { flagId: flag.id };
    }),
});
