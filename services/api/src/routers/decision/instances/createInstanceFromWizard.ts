import {
  MAX_PHASES_PER_DECISION,
  WIZARD_PHASE_KINDS,
  WIZARD_PROCESS_TYPES,
  createInstanceFromWizard,
} from '@op/common';
import { z } from 'zod';

import { decisionProfileWithSchemaEncoder } from '../../../encoders/decision';
import { authenticatedConfirmedProcedure, router } from '../../../trpcFactory';

export const createInstanceFromWizardInputSchema = z.object({
  name: z.string().trim().min(3).max(256),
  type: z.enum(WIZARD_PROCESS_TYPES),
  shape: z.string().trim().min(1).max(32),
  phases: z
    .array(
      z.object({
        kind: z.enum(WIZARD_PHASE_KINDS),
        name: z.string().trim().min(1).max(256),
      }),
    )
    .max(MAX_PHASES_PER_DECISION),
});

export const createInstanceFromWizardRouter = router({
  createInstanceFromWizard: authenticatedConfirmedProcedure()
    .input(createInstanceFromWizardInputSchema)
    .output(decisionProfileWithSchemaEncoder)
    .mutation(async ({ ctx, input }) => {
      const profile = await createInstanceFromWizard({
        draft: input,
        user: ctx.user,
      });

      return decisionProfileWithSchemaEncoder.parse(profile);
    }),
});
