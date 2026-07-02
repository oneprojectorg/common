import {
  Channels,
  updateOverviewHeroImage as updateOverviewHeroImageService,
} from '@op/common';
import { z } from 'zod';

import { authenticatedConfirmedProcedure, router } from '../../../trpcFactory';

/**
 * Records a hero image the client uploaded via a signed URL. Thin wrapper:
 * the admin assertion, storage trust-boundary check, and persistence live in
 * the @op/common service; the router registers the realtime channel so
 * subscribers re-read the new image.
 */
export const updateOverviewHeroImageRouter = router({
  updateOverviewHeroImage: authenticatedConfirmedProcedure()
    .input(
      z.object({
        instanceId: z.string().uuid(),
        storagePath: z.string(),
        mimeType: z.string(),
      }),
    )
    .output(z.object({ heroImage: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const result = await updateOverviewHeroImageService({
        input,
        user: ctx.user,
      });
      ctx.registerMutationChannels([
        Channels.decisionInstance(input.instanceId),
      ]);
      return result;
    }),
});
