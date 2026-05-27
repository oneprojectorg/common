import { Channels, getInstance } from '@op/common';
import { waitUntil } from '@vercel/functions';

import {
  getInstanceInputSchema,
  processInstanceWithSchemaEncoder,
} from '../../../encoders/decision';
import {
  legacyGetInstanceInputSchema,
  legacyProcessInstanceEncoder,
} from '../../../encoders/legacyDecision';
import {
  commonAuthedProcedure,
  commonOpenProcedure,
  router,
} from '../../../trpcFactory';
import { trackProcessViewed } from '../../../utils/analytics';

/**
 * Legacy getInstance endpoint - uses legacy encoders with state-based format.
 * Used by the legacy route: /profile/[slug]/decisions/[id]
 * @deprecated Use the new decision system instead
 */

export const getLegacyInstanceRouter = router({
  getLegacyInstance: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 30 },
  })
    .input(legacyGetInstanceInputSchema)
    .output(legacyProcessInstanceEncoder)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;

      const instance = await getInstance({
        instanceId: input.instanceId,
        user,
        accessUser: user,
      });

      // Track process viewed event
      waitUntil(trackProcessViewed(ctx, input.instanceId));

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
  getInstance: commonOpenProcedure({
    rateLimit: { windowSize: 10, maxRequests: 30 },
  })
    .input(getInstanceInputSchema)
    .output(processInstanceWithSchemaEncoder)
    .query(async ({ ctx, input }) => {
      const { user, accessUser } = ctx.authContext;

      const instance = await getInstance({
        instanceId: input.instanceId,
        user,
        accessUser,
      });

      // Track process viewed event — only for real users; anon/no-JWT
      // callers have no stable identity to attribute the view to.
      if (user) {
        waitUntil(trackProcessViewed({ ...ctx, user }, input.instanceId));
      }

      ctx.registerQueryChannels([Channels.decisionInstance(input.instanceId)]);

      return processInstanceWithSchemaEncoder.parse({
        ...instance,
        instanceData: instance.instanceData,
        process: instance.process,
      });
    }),
});
