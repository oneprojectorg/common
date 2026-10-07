import { reorderPhases } from '@op/common';
import { list } from '@op/common/client';
import { z } from 'zod';

import {
  phaseDataEncoder,
  phaseDataInputEncoder,
} from '../../../encoders/decision';
import { authenticatedConfirmedProcedure, router } from '../../../trpcFactory';

const reorderPhasesOutputSchema = list(
  z.object({
    id: z.string(),
    profileId: z.string(),
    name: z.string(),
    slug: z.string(),
    sortOrder: z.number(),
    data: phaseDataEncoder,
  }),
);

export const reorderPhasesRouter = router({
  reorderPhases: authenticatedConfirmedProcedure()
    .input(
      z.object({
        instanceId: z.uuid(),
        // Every phase of the decision, in its new order.
        phases: z
          .array(
            phaseDataInputEncoder
              .pick({ startDate: true, endDate: true })
              .extend({ phaseId: z.uuid() }),
          )
          .min(1)
          .max(100),
      }),
    )
    .output(reorderPhasesOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const items = await reorderPhases({
        user: ctx.user,
        processInstanceId: input.instanceId,
        phases: input.phases,
      });

      return reorderPhasesOutputSchema.parse({ items });
    }),
});
