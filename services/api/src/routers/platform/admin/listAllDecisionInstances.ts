import {
  decodeCursor,
  encodeCursor,
  getGenericCursorCondition,
} from '@op/common';
import { adminDecisionInstanceSchema } from '@op/common/client';
import {
  and,
  count,
  countDistinct,
  db,
  ilike,
  inArray,
  sql,
} from '@op/db/client';
import { ProposalStatus, processInstances, proposals } from '@op/db/schema';
import type { SQL } from 'drizzle-orm';
import { z } from 'zod';

import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticatedPlatformAdmin';
import withRateLimited from '../../../middlewares/withRateLimited';
import { commonProcedure, router } from '../../../trpcFactory';
import { dbFilter } from '../../../utils';

const phaseLookupInstanceData = z
  .object({
    phases: z
      .array(
        z.object({
          phaseId: z.string().optional(),
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
    ? instance.data.phases?.find((p) => p.phaseId === currentStateId)
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
      const decodedCursor = cursor ? decodeCursor(cursor) : undefined;
      const hasSearch = !!(query && query.length >= 2);

      // Used by the count() select below against the raw schema table.
      const searchCondition = hasSearch
        ? ilike(processInstances.name, `%${query}%`)
        : undefined;

      const hasWhere = !!decodedCursor || hasSearch;

      const [instances, [totalCountResult]] = await Promise.all([
        db.query.processInstances.findMany({
          // RAW receives V2's aliased table; build conditions against it.
          where: hasWhere
            ? {
                RAW: (table) => {
                  const conds: SQL[] = [];
                  if (decodedCursor) {
                    const cursorCond = getGenericCursorCondition({
                      columns: { id: table.id, date: table.createdAt },
                      cursor: decodedCursor,
                    });
                    if (cursorCond) conds.push(cursorCond);
                  }
                  if (hasSearch) {
                    conds.push(ilike(table.name, `%${query}%`));
                  }
                  return conds.length > 1 ? and(...conds)! : conds[0]!;
                },
              }
            : undefined,
          with: {
            steward: {
              columns: { name: true },
            },
            process: {
              columns: { processSchema: true },
            },
          },
          orderBy: { createdAt: dir },
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

      const proposalStats =
        instanceIds.length > 0
          ? await db
              .select({
                processInstanceId: proposals.processInstanceId,
                proposalCount:
                  sql<number>`count(*) filter (where ${proposals.status} <> ${ProposalStatus.DRAFT})`.mapWith(
                    Number,
                  ),
                totalProposalCount: count(proposals.id),
                participantCount: countDistinct(proposals.submittedByProfileId),
              })
              .from(proposals)
              .where(inArray(proposals.processInstanceId, instanceIds))
              .groupBy(proposals.processInstanceId)
          : [];

      const statsByInstance = new Map(
        proposalStats.map((row) => [row.processInstanceId, row]),
      );

      return {
        items: items.map((instance) => {
          const stats = statsByInstance.get(instance.id);
          return adminDecisionInstanceSchema.parse({
            id: instance.id,
            name: instance.name,
            currentPhase: resolveCurrentPhase({
              currentStateId: instance.currentStateId,
              instanceData: instance.instanceData,
              processSchema: instance.process?.processSchema,
            }),
            stewardName: instance.steward?.name ?? null,
            status: instance.status,
            proposalCount: stats?.proposalCount ?? 0,
            totalProposalCount: stats?.totalProposalCount ?? 0,
            participantCount: stats?.participantCount ?? 0,
            createdAt: instance.createdAt,
            instanceData: instance.instanceData,
          });
        }),
        next: nextCursor,
        total: totalCountResult?.value ?? 0,
      };
    }),
});
