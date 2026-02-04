import {
  type DecisionSchemaDefinition,
  type InstanceData,
  NotFoundError,
  type PhaseDefinition,
  UnauthorizedError,
  getInstance,
} from '@op/common';
import { TRPCError } from '@trpc/server';
import { waitUntil } from '@vercel/functions';

import {
  getInstanceInputSchema,
  processInstanceWithSchemaEncoder,
} from '../../../encoders/decision';
import {
  legacyGetInstanceInputSchema,
  legacyProcessInstanceEncoder,
} from '../../../encoders/legacyDecision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';
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
        authUserId: user.id,
        user,
      });

      // Track process viewed event
      waitUntil(trackProcessViewed(ctx, input.instanceId));

      return legacyProcessInstanceEncoder.parse({
        ...instance,
        instanceData: instance.instanceData as Record<string, any>,
        // Some typechecking since these are unknown
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
  getInstance: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 30 },
  })
    .input(getInstanceInputSchema)
    .output(processInstanceWithSchemaEncoder)
    .query(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      try {
        const instance = await getInstance({
          instanceId: input.instanceId,
          authUserId: user.id,
          user,
        });

        // Track process viewed event
        waitUntil(trackProcessViewed(ctx, input.instanceId));

        // Get schema and instance data with proper typing
        const process = instance.process as
          | { processSchema?: DecisionSchemaDefinition }
          | undefined;
        const schema = process?.processSchema;
        const instanceData = instance.instanceData as InstanceData | undefined;
        const instancePhases = instanceData?.phases;

        // Merge instance phase dates into schema phases
        const processSchemaWithDates = schema
          ? {
              ...schema,
              phases: schema.phases.map((phase: PhaseDefinition) => {
                const instancePhase = instancePhases?.find(
                  (p) => p.phaseId === phase.id,
                );
                return {
                  ...phase,
                  startDate: instancePhase?.startDate,
                  endDate: instancePhase?.endDate,
                };
              }),
            }
          : {};

        return processInstanceWithSchemaEncoder.parse({
          ...instance,
          instanceData,
          process: instance.process
            ? {
                ...instance.process,
                processSchema: processSchemaWithDates,
              }
            : undefined,
        });
      } catch (error) {
        if (error instanceof NotFoundError) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message,
          });
        }

        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: error.message,
          });
        }

        logger.error('Error retrieving process instance', {
          userId: user.id,
          instanceId: input.instanceId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve process instance',
        });
      }
    }),
});
