import { signOverviewHeroImageUploadUrl as signOverviewHeroImageUploadUrlService } from '@op/common';
import { z } from 'zod';

import { authenticatedConfirmedProcedure, router } from '../../../trpcFactory';

/**
 * Mints a signed upload URL for a decision overview hero image. Thin wrapper:
 * the admin assertion + signing live in the @op/common service.
 */
export const signOverviewHeroImageUploadUrlRouter = router({
  signOverviewHeroImageUploadUrl: authenticatedConfirmedProcedure()
    .input(
      z.object({
        instanceId: z.string().uuid(),
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
      signOverviewHeroImageUploadUrlService({ input, user: ctx.user }),
    ),
});
