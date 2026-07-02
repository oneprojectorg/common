import {
  Channels,
  removeOverviewHeroImage as removeOverviewHeroImageService,
} from '@op/common';
import { z } from 'zod';

import { authenticatedConfirmedProcedure, router } from '../../../trpcFactory';

/**
 * Clears a decision overview's hero image (and deletes the storage object).
 * Thin wrapper: the admin assertion, path clear, and object cleanup live in
 * the @op/common service; the router registers the realtime channel so
 * subscribers re-read the now-empty image.
 */
export const removeOverviewHeroImageRouter = router({
  removeOverviewHeroImage: authenticatedConfirmedProcedure()
    .input(
      z.object({
        instanceId: z.string().uuid(),
      }),
    )
    .output(z.object({ heroImage: z.literal('') }))
    .mutation(async ({ input, ctx }) => {
      const result = await removeOverviewHeroImageService({
        input,
        user: ctx.user,
      });
      ctx.registerMutationChannels([
        Channels.decisionInstance(input.instanceId),
      ]);
      return result;
    }),
});
