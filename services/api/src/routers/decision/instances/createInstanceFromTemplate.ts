import { createInstanceFromTemplate } from '@op/common';

import {
  createInstanceFromTemplateInputSchema,
  decisionProfileWithSchemaEncoder,
} from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const createInstanceFromTemplateRouter = router({
  createInstanceFromTemplate: commonAuthedProcedure()
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
