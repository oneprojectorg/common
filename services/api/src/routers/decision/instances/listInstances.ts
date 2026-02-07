import { listInstances } from '@op/common';

import {
  legacyInstanceFilterSchema,
  legacyProcessInstanceListEncoder,
} from '../../../encoders/legacyDecision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const listInstancesRouter = router({
  listInstances: commonAuthedProcedure()
    .input(legacyInstanceFilterSchema)
    .output(legacyProcessInstanceListEncoder)
    .query(async ({ input, ctx }) => {
      const { user } = ctx;

      const result = await listInstances({
        ...input,
        user,
        authUserId: ctx.user.id,
      });

      return legacyProcessInstanceListEncoder.parse({
        instances: result.instances.map((instance) => ({
          ...instance,
          instanceData: instance.instanceData as Record<string, any>,
          proposalCount: instance.proposalCount,
          participantCount: instance.participantCount,
        })),
        total: result.total,
        hasMore: result.hasMore,
      });
    }),
});
