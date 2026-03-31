import { completeOnboarding as completeOnboardingService } from '@op/common';

import { commonAuthedProcedure, router } from '../../trpcFactory';

export const completeOnboarding = router({
  completeOnboarding: commonAuthedProcedure().mutation(async ({ ctx }) => {
    await completeOnboardingService({
      authUserId: ctx.user.id,
    });
  }),
});
