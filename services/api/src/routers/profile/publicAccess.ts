import {
  isProfilePublic,
  makeProfilePublic,
  revokeProfilePublicAccess,
} from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

const outputSchema = z.object({ isPublic: z.boolean() });

/**
 * Opening a profile to the public, and closing it again.
 *
 * Both sit on {@link networkAuthenticatedProcedure} rather than a looser tier:
 * they write permission rows, which is the same class of action as
 * `updateRolePermission` beside them. The service layer decides the real
 * question — whether the caller administers this profile.
 */
export const profilePublicAccessRouter = router({
  setProfilePublic: networkAuthenticatedProcedure()
    .input(
      z.object({
        profileId: z.string().uuid(),
        isPublic: z.boolean(),
      }),
    )
    .output(outputSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.isPublic) {
        await makeProfilePublic({ profileId: input.profileId, user: ctx.user });
      } else {
        await revokeProfilePublicAccess({
          profileId: input.profileId,
          user: ctx.user,
        });
      }

      return { isPublic: input.isPublic };
    }),

  getProfilePublic: networkAuthenticatedProcedure()
    .input(z.object({ profileId: z.string().uuid() }))
    .output(outputSchema)
    .query(async ({ input }) => ({
      isPublic: await isProfilePublic(input.profileId),
    })),
});
