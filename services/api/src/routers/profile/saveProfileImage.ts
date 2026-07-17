import { saveProfileImage as saveProfileImageService } from '@op/common';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { authenticatedConfirmedProcedure, router } from '../../trpcFactory';
import { trackImageUpload } from '../../utils/analytics';

/**
 * Records a profile avatar/banner uploaded directly to storage via a signed
 * URL (see `signProfileImageUploadUrl`). Validation + persistence live in the
 * @op/common service; this wrapper only adds analytics.
 */
export const saveProfileImageRouter = router({
  saveProfileImage: authenticatedConfirmedProcedure()
    .input(
      z.object({
        profileId: z.string().uuid(),
        storagePath: z.string().min(1),
        mimeType: z.string().min(1),
        imageType: z.enum(['avatar', 'banner']),
      }),
    )
    .output(z.object({ storagePath: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { storagePath, hadPreviousImage } = await saveProfileImageService({
        input,
        user: ctx.user,
      });
      waitUntil(
        trackImageUpload(
          ctx,
          input.imageType === 'avatar' ? 'profile' : 'banner',
          hadPreviousImage,
        ),
      );
      return { storagePath };
    }),
});
