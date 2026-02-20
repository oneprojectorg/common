import { listLegacyInstances } from '@op/common';

import {
  legacyInstanceListEncoder,
  legacyOnlyInstanceFilterSchema,
  legacyProcessInstanceEncoder,
} from '../../../encoders/legacyDecision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const listLegacyInstancesRouter = router({
  listLegacyInstances: commonAuthedProcedure()
    .input(legacyOnlyInstanceFilterSchema)
    .output(legacyInstanceListEncoder)
    .query(async ({ input, ctx }) => {
      const result = await listLegacyInstances({
        ...input,
        user: ctx.user,
      });

      const validInstances = result.filter(
        (instance) => legacyProcessInstanceEncoder.safeParse(instance).success,
      );

      return legacyInstanceListEncoder.parse(validInstances);
    }),
});
