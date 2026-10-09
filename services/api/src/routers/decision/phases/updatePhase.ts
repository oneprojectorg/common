import { updatePhase } from '@op/common';
import { z } from 'zod';

import {
  phaseDataEncoder,
  phaseDataInputEncoder,
} from '../../../encoders/decision';
import { authenticatedConfirmedProcedure, router } from '../../../trpcFactory';

const updatePhaseOutputSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  name: z.string(),
  slug: z.string(),
  data: phaseDataEncoder,
});

export const updatePhaseRouter = router({
  updatePhase: authenticatedConfirmedProcedure()
    .input(
      z
        .object({
          phaseId: z.uuid(),
          name: z.string().trim().min(1).max(256).optional(),
          data: phaseDataInputEncoder.optional(),
        })
        .refine(
          (input) => input.name !== undefined || input.data !== undefined,
          { message: 'Provide a name, data, or both' },
        ),
    )
    .output(updatePhaseOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const { phase, profile } = await updatePhase({
        user: ctx.user,
        phaseId: input.phaseId,
        name: input.name,
        data: input.data,
      });

      return updatePhaseOutputSchema.parse({
        id: phase.id,
        profileId: profile.id,
        name: profile.name,
        slug: profile.slug,
        data: phase.data,
      });
    }),
});
