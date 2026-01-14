import { createInstanceFromTemplate } from '@op/common';

import {
  createInstanceFromTemplateInputSchema,
  decisionProfileEncoder,
} from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const createInstanceFromTemplateRouter = router({
  createInstanceFromTemplate: commonAuthedProcedure()
    .input(createInstanceFromTemplateInputSchema)
    .output(decisionProfileEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const profile = await createInstanceFromTemplate({
        ...input,
        user,
      });

      return decisionProfileEncoder.parse(profile);
    }),
});
