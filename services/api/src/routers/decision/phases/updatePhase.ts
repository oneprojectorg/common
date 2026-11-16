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
  selectionNeedsApproval: z.boolean(),
});

export const updatePhaseRouter = router({
  updatePhase: authenticatedConfirmedProcedure()
    .input(
      z
        .object({
          phaseId: z.uuid(),
          name: z.string().trim().min(1).max(256).optional(),
          data: phaseDataInputEncoder.optional(),
          selectionNeedsApproval: z.boolean().optional(),
        })
        .refine(
          (input) =>
            input.name !== undefined ||
            input.data !== undefined ||
            input.selectionNeedsApproval !== undefined,
          { message: 'Provide a name, data, or selectionNeedsApproval' },
        ),
    )
    .output(updatePhaseOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const { phase, profile } = await updatePhase({
        user: ctx.user,
        phaseId: input.phaseId,
        name: input.name,
        data: input.data,
        selectionNeedsApproval: input.selectionNeedsApproval,
      });

      return updatePhaseOutputSchema.parse({
        id: phase.id,
        profileId: profile.id,
        name: profile.name,
        slug: profile.slug,
        data: phase.data,
        selectionNeedsApproval: phase.selectionNeedsApproval,
      });
    }),
});
