import {
  decodeCursor,
  encodeCursor,
  getGenericCursorCondition,
} from '@op/common';
import { adminDecisionInstanceSchema } from '@op/common/client';
import { and, count, db, ilike, inArray } from '@op/db/client';
import { processInstances, proposals } from '@op/db/schema';
import { z } from 'zod';

import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticatedPlatformAdmin';
import withRateLimited from '../../../middlewares/withRateLimited';
import { commonProcedure, router } from '../../../trpcFactory';
import { dbFilter } from '../../../utils';

// Drizzle's _query typing widens single `one` relations to `T | T[]` when nested
// in findMany. See services/api/src/routers/decision/proposals/get.ts:54 for the
// same workaround.
const unwrapOne = <T>(value: T | T[] | null | undefined): T | undefined => {
  if (value == null) {
    return undefined;
  }
  return Array.isArray(value) ? value[0] : value;
};

const phaseLookupInstanceData = z
  .object({
    phases: z
      .array(
        z.object({
          phaseId: z.string().optional(),
          // Legacy name for phaseId; see instanceDataEncoder preprocessor in decision.ts
          stateId: z.string().optional(),
          name: z.string().optional(),
          endDate: z.string().optional(),
        }),
      )
      .optional(),
  })
  .partial();

const phaseLookupProcessSchema = z
  .object({
    phases: z
      .array(
        z.object({
          id: z.string(),
          name: z.string().optional(),
        }),
      )
      .optional(),
  })
  .partial();

const resolveCurrentPhase = ({
  currentStateId,
  instanceData,
  processSchema,
}: {
  currentStateId: string | null;
  instanceData: unknown;
  processSchema: unknown;
}) => {
  if (!currentStateId) {
    return null;
  }

  const instance = phaseLookupInstanceData.safeParse(instanceData);
  const schema = phaseLookupProcessSchema.safeParse(processSchema);

  const instancePhase = instance.success
    ? instance.data.phases?.find(
        (p) => (p.phaseId ?? p.stateId) === currentStateId,
      )
    : undefined;
  const schemaPhase = schema.success
    ? schema.data.phases?.find((p) => p.id === currentStateId)
    : undefined;

  return {
    id: currentStateId,
    name: instancePhase?.name ?? schemaPhase?.name ?? null,
    endDate: instancePhase?.endDate ?? null,
  };
};

export const listAllDecisionInstancesRouter = router({
  listAllDecisionInstances: commonProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticatedPlatformAdmin)
    .input(
      dbFilter
        .extend({
          /** string for searching decision instances by name */
          query: z.string().optional(),
        })
        .optional(),
    )
    .output(
      z.object({
        items: z.array(adminDecisionInstanceSchema),
        next: z.string().nullish(),
        total: z.number(),
      }),
    )
    .query(async ({ input }) => {
      const { cursor, dir = 'desc', query, limit } = input ?? {};

      const cursorCondition = cursor
        ? getGenericCursorCondition({
            columns: {
              id: processInstances.id,
              date: processInstances.createdAt,
            },
            cursor: decodeCursor(cursor),
          })
        : undefined;

      const searchCondition =
        query && query.length >= 2
          ? ilike(processInstances.name, `%${query}%`)
          : undefined;

      const whereCondition =
        searchCondition && cursorCondition
          ? and(cursorCondition, searchCondition)
          : searchCondition || cursorCondition;

      const [instances, [totalCountResult]] = await Promise.all([
        db._query.processInstances.findMany({
          where: whereCondition,
          with: {
            steward: {
              columns: { name: true },
            },
            process: {
              columns: { processSchema: true },
            },
          },
          orderBy: (_, { asc, desc }) =>
            dir === 'asc'
              ? asc(processInstances.createdAt)
              : desc(processInstances.createdAt),
          ...(limit !== undefined && { limit: limit + 1 }),
        }),
        db
          .select({ value: count() })
          .from(processInstances)
          .where(searchCondition),
      ]);

      const hasMore = limit !== undefined && instances.length > limit;
      const items = hasMore ? instances.slice(0, limit) : instances;
      const lastItem = items[items.length - 1];
      const nextCursor =
        hasMore && lastItem && lastItem.createdAt
          ? encodeCursor({
              date: new Date(lastItem.createdAt),
              id: lastItem.id,
            })
          : null;

      const instanceIds = items.map((i) => i.id);

      // Fetch (instanceId, profileId) proposal pairs so we can compute
      // per-instance proposal count and distinct-participant count in memory.
      const proposalPairs =
        instanceIds.length > 0
          ? await db
              .select({
                processInstanceId: proposals.processInstanceId,
                profileId: proposals.submittedByProfileId,
              })
              .from(proposals)
              .where(inArray(proposals.processInstanceId, instanceIds))
          : [];

      const proposalCounts = new Map<string, number>();
      const participantSets = new Map<string, Set<string>>();

      for (const row of proposalPairs) {
        proposalCounts.set(
          row.processInstanceId,
          (proposalCounts.get(row.processInstanceId) ?? 0) + 1,
        );
        const set =
          participantSets.get(row.processInstanceId) ?? new Set<string>();
        set.add(row.profileId);
        participantSets.set(row.processInstanceId, set);
      }

      return {
        items: items.map((instance) => {
          const steward = unwrapOne(instance.steward);
          const process = unwrapOne(instance.process);
          return adminDecisionInstanceSchema.parse({
            id: instance.id,
            name: instance.name,
            currentPhase: resolveCurrentPhase({
              currentStateId: instance.currentStateId,
              instanceData: instance.instanceData,
              processSchema: process?.processSchema,
            }),
            stewardName: steward?.name ?? null,
            status: instance.status,
            proposalCount: proposalCounts.get(instance.id) ?? 0,
            participantCount: participantSets.get(instance.id)?.size ?? 0,
            createdAt: instance.createdAt,
            instanceData: instance.instanceData,
          });
        }),
        next: nextCursor,
        total: totalCountResult?.value ?? 0,
      };
    }),
});
