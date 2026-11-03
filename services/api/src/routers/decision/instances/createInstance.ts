import { createInstance, withProfileInstancePhases } from '@op/common';
import { createInstanceSchema } from '@op/common/client';

import { decisionProfileWithSchemaEncoder } from '../../../encoders/decision';
import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const createInstanceRouter = router({
  createInstance: networkAuthenticatedProcedure()
    .input(createInstanceSchema)
    .output(decisionProfileWithSchemaEncoder)
    .mutation(async ({ ctx, input }) => {
      const profile = await createInstance({
        draft: input,
        user: ctx.user,
      });

      return decisionProfileWithSchemaEncoder.parse(
        await withProfileInstancePhases({ profile }),
      );
    }),
});
