import { cache } from '@op/cache';
import { Channels, getInstance, loadDecisionInstance } from '@op/common';

import {
  getInstanceInputSchema,
  processInstanceWithSchemaEncoder,
} from '../../../encoders/decision';
import {
  legacyGetInstanceInputSchema,
  legacyProcessInstanceEncoder,
} from '../../../encoders/legacyDecision';
import {
  networkAuthenticatedProcedure,
  openProcedure,
  router,
} from '../../../trpcFactory';

/**
 * Cache the viewer-independent portion of a decision instance read. Every
 * mutation that touches `processInstances` invalidates the same `[id,
 * 'instance']` params (see `invalidateDecisionInstance` in `@op/common`), so
 * cached entries can't outlive an instance-level write. The per-user access
 * computation stays outside the cache and runs on every read.
 */
const cachedLoadDecisionInstance = (instanceId: string) =>
  cache({
    type: 'decision',
    params: [instanceId, 'instance'],
    fetch: () => loadDecisionInstance({ instanceId }),
  });

/**
 * Legacy getInstance endpoint - uses legacy encoders with state-based format.
 * Used by the legacy route: /profile/[slug]/decisions/[id]
 * @deprecated Use the new decision system instead
 */

export const getLegacyInstanceRouter = router({
  getLegacyInstance: networkAuthenticatedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 30 },
  })
    .input(legacyGetInstanceInputSchema)
    .output(legacyProcessInstanceEncoder)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;

      const preloaded = await cachedLoadDecisionInstance(input.instanceId);

      const instance = await getInstance({
        instanceId: input.instanceId,
        user,
        preloaded,
      });

      return legacyProcessInstanceEncoder.parse({
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
      });
    }),
});

/**
 * New getInstance endpoint - uses v2 encoders with phase-based format.
 * Used by the new route: /decisions/[slug]
 * Only supports new decision-making schemas.
 */
export const getInstanceRouter = router({
  getInstance: openProcedure({
    rateLimit: { windowSize: 10, maxRequests: 30 },
  })
    .input(getInstanceInputSchema)
    .output(processInstanceWithSchemaEncoder)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;

      const preloaded = await cachedLoadDecisionInstance(input.instanceId);

      const instance = await getInstance({
        instanceId: input.instanceId,
        user,
        preloaded,
      });

      ctx.registerQueryChannels([Channels.decisionInstance(input.instanceId)]);

      return processInstanceWithSchemaEncoder.parse({
        ...instance,
        instanceData: instance.instanceData,
        process: instance.process,
      });
    }),
});
