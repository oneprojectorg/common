import { createPhase } from '@op/common';
import { z } from 'zod';

import { createPhaseDataInputEncoder } from '../../../encoders/decision';
import { authenticatedConfirmedProcedure, router } from '../../../trpcFactory';

const createPhaseOutputSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  processInstanceId: z.string(),
  sortOrder: z.number(),
  name: z.string(),
  slug: z.string(),
  selectionNeedsApproval: z.boolean(),
});

export const createPhaseRouter = router({
  createPhase: authenticatedConfirmedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 30 },
  })
    .input(
      z.object({
        instanceId: z.uuid(),
        name: z.string().trim().min(1).max(256),
        sortOrder: z.number().int().min(0).max(2_147_483_647),
        data: createPhaseDataInputEncoder.optional(),
        selectionNeedsApproval: z.boolean().optional(),
      }),
    )
    .output(createPhaseOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const { phase, profile } = await createPhase({
        user: ctx.user,
        processInstanceId: input.instanceId,
        name: input.name,
        sortOrder: input.sortOrder,
        data: input.data,
        selectionNeedsApproval: input.selectionNeedsApproval,
      });

      return createPhaseOutputSchema.parse({
        id: phase.id,
        profileId: profile.id,
        processInstanceId: phase.processInstanceId,
        sortOrder: phase.sortOrder,
        name: profile.name,
        slug: profile.slug,
        selectionNeedsApproval: phase.selectionNeedsApproval,
      });
    }),
});
