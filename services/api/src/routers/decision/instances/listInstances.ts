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

      const encoded = result.instances
        .map((instance) => ({
          ...instance,
          instanceData: instance.instanceData,
          process: instance.process
            ? {
                ...instance.process,
                processSchema: (() => {
                  const schema = (instance.process as any)?.processSchema;
                  return typeof schema === 'object' &&
                    schema !== null &&
                    !Array.isArray(schema)
                    ? schema
                    : {};
                })(),
              }
            : undefined,
          proposalCount: instance.proposalCount,
          participantCount: instance.participantCount,
        }))
        .filter((instance) => {
          const parsed =
            legacyProcessInstanceListEncoder.shape.instances.element.safeParse(
              instance,
            );
          return parsed.success;
        });

      return legacyProcessInstanceListEncoder.parse({
        instances: encoded,
        total: encoded.length,
        hasMore: false,
      });
    }),
});
