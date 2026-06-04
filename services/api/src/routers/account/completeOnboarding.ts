import { invalidate } from '@op/cache';
import { completeOnboarding as completeOnboardingService } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

export const completeOnboarding = router({
  completeOnboarding: networkAuthenticatedProcedure()
    .input(
      z.object({
        tos: z.boolean(),
        privacy: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await completeOnboardingService({
        authUserId: ctx.user.id,
        tos: input.tos,
        privacy: input.privacy,
      });

      await invalidate({
        type: 'user',
        params: [ctx.user.id],
      });
    }),
});
