import {
  Channels,
  removePhaseHeroImage as removePhaseHeroImageService,
} from '@op/common';
import { z } from 'zod';

import { authenticatedConfirmedProcedure, router } from '../../../trpcFactory';

/**
 * Clears a decision phase's hero image (and deletes the storage object). Thin
 * wrapper: the admin assertion, path clear, and object cleanup live in the
 * @op/common service; the router registers the realtime channel so subscribers
 * re-read the now-empty image.
 */
export const removePhaseHeroImageRouter = router({
  removePhaseHeroImage: authenticatedConfirmedProcedure()
    .input(
      z.object({
        instanceId: z.string().uuid(),
        phaseId: z.string().min(1),
      }),
    )
    .output(z.object({ heroImage: z.literal('') }))
    .mutation(async ({ input, ctx }) => {
      const result = await removePhaseHeroImageService({
        input,
        user: ctx.user,
      });
      ctx.registerMutationChannels([
        Channels.decisionInstance(input.instanceId),
      ]);
      return result;
    }),
});
