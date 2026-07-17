import { signProfileImageUploadUrl as signProfileImageUploadUrlService } from '@op/common';
import { z } from 'zod';

import { authenticatedConfirmedProcedure, router } from '../../trpcFactory';

/**
 * Mints a signed upload URL for a profile's avatar or banner (personal or
 * org profiles). Thin wrapper: the access assertion + signing live in the
 * @op/common service.
 */
export const signProfileImageUploadUrlRouter = router({
  signProfileImageUploadUrl: authenticatedConfirmedProcedure()
    .input(
      z.object({
        profileId: z.string().uuid(),
        fileName: z.string().min(1).max(255),
        imageType: z.enum(['avatar', 'banner']),
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
      signProfileImageUploadUrlService({ input, user: ctx.user }),
    ),
});
