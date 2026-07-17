import { signDraftProfileImageUploadUrl as signDraftProfileImageUploadUrlService } from '@op/common';
import { z } from 'zod';

import { authenticatedConfirmedProcedure, router } from '../../trpcFactory';

/**
 * Mints a signed upload URL in the caller's own draft space, for profile
 * images uploaded before the target profile exists (create-organization
 * flows). The path is validated + persisted later by the mutation that
 * creates the profile, via `claimDraftProfileImage`.
 */
export const signDraftProfileImageUploadUrlRouter = router({
  signDraftProfileImageUploadUrl: authenticatedConfirmedProcedure()
    .input(
      z.object({
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
      signDraftProfileImageUploadUrlService({ input, user: ctx.user }),
    ),
});
