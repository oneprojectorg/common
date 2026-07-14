import { signPhaseHeroImageUploadUrl as signPhaseHeroImageUploadUrlService } from '@op/common';
import { z } from 'zod';

import { authenticatedConfirmedProcedure, router } from '../../../trpcFactory';

/**
 * Mints a signed upload URL for a decision phase hero image. Thin wrapper:
 * the admin assertion + signing live in the @op/common service.
 */
export const signPhaseHeroImageUploadUrlRouter = router({
  signPhaseHeroImageUploadUrl: authenticatedConfirmedProcedure()
    .input(
      z.object({
        instanceId: z.string().uuid(),
        phaseId: z.string().min(1),
        fileName: z.string().min(1).max(255),
      }),
    )
    .output(
      z.object({
        storagePath: z.string(),
        signedUrl: z.string().url(),
        token: z.string(),
      }),
    )
    .mutation(({ input, ctx }) =>
      signPhaseHeroImageUploadUrlService({ input, user: ctx.user }),
    ),
});
