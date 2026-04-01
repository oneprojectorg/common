import { duplicateInstance } from '@op/common';
import { z } from 'zod';

import { decisionProfileWithSchemaEncoder } from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

const duplicateInstanceInputSchema = z.object({
  instanceId: z.string().uuid(),
  name: z.string().min(1).max(255).trim(),
  stewardProfileId: z.string().uuid().optional(),
  include: z.object({
    processSettings: z.boolean(),
    phases: z.boolean(),
    proposalCategories: z.boolean(),
    proposalTemplate: z.boolean(),
    reviewSettings: z.boolean(),
    reviewRubric: z.boolean(),
    roles: z.boolean(),
  }),
});

export const duplicateInstanceRouter = router({
  duplicateInstance: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 5 },
  })
    .input(duplicateInstanceInputSchema)
    .output(decisionProfileWithSchemaEncoder)
    .mutation(async ({ ctx, input }) => {
      const profile = await duplicateInstance({
        ...input,
        user: ctx.user,
      });

      return decisionProfileWithSchemaEncoder.parse(profile);
    }),
});
