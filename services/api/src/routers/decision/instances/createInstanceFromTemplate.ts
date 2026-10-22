import { createInstanceFromTemplate } from '@op/common';

import {
  createInstanceFromTemplateInputSchema,
  decisionProfileWithSchemaEncoder,
} from '../../../encoders/decision';
import { authenticatedConfirmedProcedure, router } from '../../../trpcFactory';

export const createInstanceFromTemplateRouter = router({
  createInstanceFromTemplate: authenticatedConfirmedProcedure()
    .input(createInstanceFromTemplateInputSchema)
    .output(decisionProfileWithSchemaEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const profile = await createInstanceFromTemplate({
        ...input,
        user,
      });

      return decisionProfileWithSchemaEncoder.parse(profile);
    }),
});
