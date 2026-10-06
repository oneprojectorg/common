import { renamePhase } from '@op/common';
import { z } from 'zod';

import { authenticatedConfirmedProcedure, router } from '../../../trpcFactory';

const renamePhaseOutputSchema = z.object({
  profileId: z.string(),
  name: z.string(),
  slug: z.string(),
});

export const renamePhaseRouter = router({
  renamePhase: authenticatedConfirmedProcedure()
    .input(
      z.object({
        phaseId: z.uuid(),
        name: z.string().trim().min(1).max(256),
      }),
    )
    .output(renamePhaseOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const profile = await renamePhase({
        user: ctx.user,
        phaseId: input.phaseId,
        name: input.name,
      });

      return renamePhaseOutputSchema.parse({
        profileId: profile.id,
        name: profile.name,
        slug: profile.slug,
      });
    }),
});
