import {
  MAX_PHASES_PER_DECISION,
  PROCESS_NAME_MAX_LENGTH,
  PROCESS_NAME_MIN_LENGTH,
  WIZARD_PHASE_KINDS,
  WIZARD_PROCESS_TYPES,
  createInstanceFromWizard,
} from '@op/common';
import { z } from 'zod';

import { decisionProfileWithSchemaEncoder } from '../../../encoders/decision';
import { authenticatedConfirmedProcedure, router } from '../../../trpcFactory';

export const createInstanceFromWizardInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(PROCESS_NAME_MIN_LENGTH)
    .max(PROCESS_NAME_MAX_LENGTH),
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
