import { createInstanceFromWizard } from '@op/common';
import { wizardDraftSchema } from '@op/common/client';

import { decisionProfileWithSchemaEncoder } from '../../../encoders/decision';
import { authenticatedConfirmedProcedure, router } from '../../../trpcFactory';

export const createInstanceFromWizardRouter = router({
  createInstanceFromWizard: authenticatedConfirmedProcedure()
    .input(wizardDraftSchema)
    .output(decisionProfileWithSchemaEncoder)
    .mutation(async ({ ctx, input }) => {
      const profile = await createInstanceFromWizard({
        draft: input,
        user: ctx.user,
      });

      return decisionProfileWithSchemaEncoder.parse(profile);
    }),
});
