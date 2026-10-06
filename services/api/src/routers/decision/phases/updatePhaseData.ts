import { phaseDataSchema, updatePhaseData } from '@op/common';
import { z } from 'zod';

import { authenticatedConfirmedProcedure, router } from '../../../trpcFactory';

const updatePhaseDataOutputSchema = z.object({
  id: z.string(),
  data: phaseDataSchema,
});

export const updatePhaseDataRouter = router({
  updatePhaseData: authenticatedConfirmedProcedure()
    .input(
      z.object({
        phaseId: z.uuid(),
        data: phaseDataSchema,
      }),
    )
    .output(updatePhaseDataOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const phase = await updatePhaseData({
        user: ctx.user,
        phaseId: input.phaseId,
        data: input.data,
      });

      return updatePhaseDataOutputSchema.parse({
        id: phase.id,
        data: phase.data,
      });
    }),
});
