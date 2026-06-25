import { cache } from '@op/cache';
import { Channels, getInstance } from '@op/common';

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

// `getInstance` returns viewer-specific `access` bits, so the cache key has to
// include the caller — sharing a single key across users would leak one viewer's
// permissions to the next. Writer-side invalidation (see `updateDecisionInstance`
// etc.) drops the writer's own key; other viewers reconcile via this TTL.
const INSTANCE_CACHE_TTL_MS = 5 * 60 * 1000;
const callerKey = (userId: string | undefined) => userId ?? 'anon';

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

      const instance = await cache({
        type: 'decision',
        params: [input.instanceId, callerKey(user?.id), 'instance'],
        fetch: () => getInstance({ instanceId: input.instanceId, user }),
        options: { ttl: INSTANCE_CACHE_TTL_MS },
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

      const instance = await cache({
        type: 'decision',
        params: [input.instanceId, callerKey(user?.id), 'instance'],
        fetch: () => getInstance({ instanceId: input.instanceId, user }),
        options: { ttl: INSTANCE_CACHE_TTL_MS },
      });

      ctx.registerQueryChannels([Channels.decisionInstance(input.instanceId)]);

      return processInstanceWithSchemaEncoder.parse({
        ...instance,
        instanceData: instance.instanceData,
        process: instance.process,
      });
    }),
});
