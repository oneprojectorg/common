import { cache } from '@op/cache';
import {
  decodeCursor,
  encodeCursor,
  getGenericCursorCondition,
} from '@op/common';
import { and, count, db, ilike, inArray, sql } from '@op/db/client';
import {
  decisionsVoteSubmissions,
  processInstances,
  proposals,
} from '@op/db/schema';
import crypto from 'crypto';
import { z } from 'zod';

import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticatedPlatformAdmin';
import withRateLimited from '../../../middlewares/withRateLimited';
import { commonProcedure, router } from '../../../trpcFactory';
import { dbFilter } from '../../../utils';

const adminDecisionInstanceEncoder = z.object({
  id: z.string(),
  name: z.string(),
  currentStateId: z.string().nullable(),
  stewardName: z.string().nullable(),
  status: z.string().nullable(),
  proposalCount: z.number(),
  voterCount: z.number(),
  participantCount: z.number(),
  createdAt: z.string().nullable(),
  instanceData: z.unknown(),
});

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
        items: z.array(adminDecisionInstanceEncoder),
        next: z.string().nullish(),
        hasMore: z.boolean(),
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

      const [instances, totalCountResult] = await Promise.all([
        db._query.processInstances.findMany({
          where: whereCondition,
          with: {
            steward: {
              columns: { name: true },
            },
          },
          orderBy: (_, { asc, desc }) =>
            dir === 'asc'
              ? asc(processInstances.createdAt)
              : desc(processInstances.createdAt),
          ...(limit !== undefined && { limit: limit + 1 }),
        }),
        cache<{ value: number }>({
          type: 'decision',
          params: ['admin-search-total-' + (query ? hashSearch(query) : 'all')],
          fetch: async () => {
            const [result] = await db
              .select({ value: count() })
              .from(processInstances)
              .where(searchCondition);
            return result ?? { value: 0 };
          },
          options: {
            ttl: 1 * 60 * 1000,
            skipMemCache: true,
          },
        }),
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

      const totalCount = totalCountResult.value ?? 0;

      // Batch count proposals and voters for the current page of instances
      const instanceIds = items.map((i) => i.id);

      const [proposalCounts, voterCounts, submitterProfiles, voterProfiles] =
        instanceIds.length > 0
          ? await Promise.all([
              db
                .select({
                  processInstanceId: proposals.processInstanceId,
                  count: sql<number>`count(*)::int`,
                })
                .from(proposals)
                .where(inArray(proposals.processInstanceId, instanceIds))
                .groupBy(proposals.processInstanceId),
              db
                .select({
                  processInstanceId: decisionsVoteSubmissions.processInstanceId,
                  count: sql<number>`count(*)::int`,
                })
                .from(decisionsVoteSubmissions)
                .where(
                  inArray(
                    decisionsVoteSubmissions.processInstanceId,
                    instanceIds,
                  ),
                )
                .groupBy(decisionsVoteSubmissions.processInstanceId),
              // Fetch distinct proposal submitter profile IDs per instance
              db
                .select({
                  processInstanceId: proposals.processInstanceId,
                  profileId: proposals.submittedByProfileId,
                })
                .from(proposals)
                .where(inArray(proposals.processInstanceId, instanceIds))
                .groupBy(
                  proposals.processInstanceId,
                  proposals.submittedByProfileId,
                ),
              // Fetch distinct voter profile IDs per instance
              db
                .select({
                  processInstanceId: decisionsVoteSubmissions.processInstanceId,
                  profileId: decisionsVoteSubmissions.submittedByProfileId,
                })
                .from(decisionsVoteSubmissions)
                .where(
                  inArray(
                    decisionsVoteSubmissions.processInstanceId,
                    instanceIds,
                  ),
                )
                .groupBy(
                  decisionsVoteSubmissions.processInstanceId,
                  decisionsVoteSubmissions.submittedByProfileId,
                ),
            ])
          : [[], [], [], []];

      const proposalCountMap = new Map(
        proposalCounts.map((r) => [r.processInstanceId, r.count]),
      );
      const voterCountMap = new Map(
        voterCounts.map((r) => [r.processInstanceId, r.count]),
      );

      // Merge unique participant profiles per instance
      const participantSets = new Map<string, Set<string>>();
      for (const r of submitterProfiles) {
        const set = participantSets.get(r.processInstanceId) ?? new Set();
        set.add(r.profileId);
        participantSets.set(r.processInstanceId, set);
      }
      for (const r of voterProfiles) {
        const set = participantSets.get(r.processInstanceId) ?? new Set();
        set.add(r.profileId);
        participantSets.set(r.processInstanceId, set);
      }
      const participantCountMap = new Map(
        [...participantSets.entries()].map(([id, set]) => [id, set.size]),
      );

      return {
        items: items.map((instance) =>
          adminDecisionInstanceEncoder.parse({
            id: instance.id,
            name: instance.name,
            currentStateId: instance.currentStateId,
            stewardName: Array.isArray(instance.steward)
              ? (instance.steward[0]?.name ?? null)
              : (instance.steward?.name ?? null),
            status: instance.status,
            proposalCount: proposalCountMap.get(instance.id) ?? 0,
            voterCount: voterCountMap.get(instance.id) ?? 0,
            participantCount: participantCountMap.get(instance.id) ?? 0,
            createdAt: instance.createdAt,
            instanceData: instance.instanceData,
          }),
        ),
        next: nextCursor,
        hasMore,
        total: totalCount,
      };
    }),
});

function hashSearch(search: string) {
  return crypto.createHash('md5').update(search).digest('hex').substring(0, 16);
}
