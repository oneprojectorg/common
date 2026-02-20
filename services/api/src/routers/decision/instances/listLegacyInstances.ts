import { listLegacyInstances } from '@op/common';

import {
  legacyOnlyInstanceFilterSchema,
  legacyProcessInstanceListEncoder,
} from '../../../encoders/legacyDecision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const listLegacyInstancesRouter = router({
  listLegacyInstances: commonAuthedProcedure()
    .input(legacyOnlyInstanceFilterSchema)
    .output(legacyProcessInstanceListEncoder)
    .query(async ({ input, ctx }) => {
      const result = await listLegacyInstances({
        ...input,
        user: ctx.user,
        authUserId: ctx.user.id,
      });

      return legacyProcessInstanceListEncoder.parse(result);
    }),
});
