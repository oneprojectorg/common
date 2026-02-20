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

      const instanceEncoder =
        legacyProcessInstanceListEncoder.shape.instances.element;

      const instances = result.instances.filter(
        (instance) => instanceEncoder.safeParse(instance).success,
      );

      return legacyProcessInstanceListEncoder.parse({
        instances,
        total: instances.length,
        hasMore: result.hasMore,
      });
    }),
});
