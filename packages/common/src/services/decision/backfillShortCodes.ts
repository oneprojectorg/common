import {
  type DbClient,
  and,
  db as defaultDb,
  eq,
  isNull,
  notInArray,
  sql,
} from '@op/db/client';
import { processInstances, proposals } from '@op/db/schema';

import { NotFoundError } from '../../utils';
import { VOTING_INELIGIBLE_STATUSES } from './votingEligibility';

export interface InstanceNeedingShortCodes {
  instanceId: string;
  missing: number;
}

export interface BackfillShortCodesResult {
  assigned: number;
  nextShortCode: number;
}

export const listInstancesNeedingShortCodes = async ({
  db = defaultDb,
}: { db?: DbClient } = {}): Promise<InstanceNeedingShortCodes[]> => {
  const rows = await db
    .select({
      instanceId: proposals.processInstanceId,
      missing: sql<number>`count(*)::int`,
    })
    .from(proposals)
    .innerJoin(
      processInstances,
      eq(processInstances.id, proposals.processInstanceId),
    )
    .where(
      and(
        isNull(proposals.deletedAt),
        isNull(proposals.moderationDetachedAt),
        isNull(proposals.shortCode),
        isNull(processInstances.deletedAt),
        notInArray(proposals.status, [...VOTING_INELIGIBLE_STATUSES]),
      ),
    )
    .groupBy(proposals.processInstanceId);

  return rows.map(({ instanceId, missing }) => ({ instanceId, missing }));
};

export const backfillInstanceShortCodes = async ({
  instanceId,
  db = defaultDb,
}: {
  instanceId: string;
  db?: DbClient;
}): Promise<BackfillShortCodesResult> =>
  db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ nextShortCode: processInstances.nextShortCode })
      .from(processInstances)
      .where(eq(processInstances.id, instanceId))
      .limit(1)
      .for('update');

    if (!locked) {
      throw new NotFoundError('Process instance', instanceId);
    }

    const assignedRows = await tx.execute(sql`
      WITH numbered AS (
        SELECT
          p.id,
          ${locked.nextShortCode} - 1 + row_number() OVER (
            ORDER BY p.created_at, p.id
          ) AS code
        FROM ${proposals} p
        WHERE p.process_instance_id = ${instanceId}
          AND p.deleted_at IS NULL
          AND p.moderation_detached_at IS NULL
          AND p.short_code IS NULL
          AND p.status NOT IN ${sql.raw(
            `(${VOTING_INELIGIBLE_STATUSES.map((status) => `'${status}'`).join(', ')})`,
          )}
      )
      UPDATE ${proposals} p
      SET short_code = n.code
      FROM numbered n
      WHERE p.id = n.id
      RETURNING p.id
    `);

    const assigned = assignedRows.length;
    const nextShortCode = locked.nextShortCode + assigned;

    if (assigned > 0) {
      await tx
        .update(processInstances)
        .set({ nextShortCode })
        .where(eq(processInstances.id, instanceId));
    }

    return { assigned, nextShortCode };
  });
