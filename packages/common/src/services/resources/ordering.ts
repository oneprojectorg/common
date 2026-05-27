import type { db as dbType } from '@op/db/client';
import { resourceCollectionItems } from '@op/db/schema';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';

import { NotFoundError } from '../../utils/error';
import { reorderByUpperNeighbor } from '../../utils/sorting';

type Transaction = Parameters<Parameters<typeof dbType.transaction>[0]>[0];
export type DbOrTx = typeof dbType | Transaction;

// Serializes concurrent ordering writes on one collection for the transaction.
export const lockCollection = async ({
  tx,
  collectionId,
}: {
  tx: Transaction;
  collectionId: string;
}): Promise<void> => {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${'resources:' + collectionId}))`,
  );
};

// Shift existing items up by one so the caller can insert at sortOrder 0.
// Two-pass via a negative range — a single `+ 1` UPDATE trips the per-row
// unique index on (collection_id, sort_order). Same trick as
// applySortOrderUpdates.
export const shiftSortOrderForInsertAtTop = async ({
  tx,
  collectionId,
}: {
  tx: Transaction;
  collectionId: string;
}): Promise<void> => {
  await tx
    .update(resourceCollectionItems)
    .set({ sortOrder: sql`-1 - ${resourceCollectionItems.sortOrder}` })
    .where(eq(resourceCollectionItems.collectionId, collectionId));

  await tx
    .update(resourceCollectionItems)
    .set({ sortOrder: sql`-${resourceCollectionItems.sortOrder}` })
    .where(eq(resourceCollectionItems.collectionId, collectionId));
};

// Caller must hold lockCollection so concurrent writers each re-interpret
// upperNeighborId against the freshly-restriped state.
export const computeReorder = async ({
  tx,
  collectionId,
  itemId,
  upperNeighborId,
}: {
  tx: Transaction;
  collectionId: string;
  itemId: string;
  upperNeighborId: string | null;
}): Promise<{ updates: Array<{ id: string; sortOrder: number }> } | null> => {
  if (itemId === upperNeighborId) {
    return null;
  }

  const rows = await tx
    .select({
      id: resourceCollectionItems.id,
      resourceId: resourceCollectionItems.resourceId,
      sortOrder: resourceCollectionItems.sortOrder,
    })
    .from(resourceCollectionItems)
    .where(eq(resourceCollectionItems.collectionId, collectionId))
    .orderBy(asc(resourceCollectionItems.sortOrder));

  if (!rows.some((r) => r.resourceId === itemId)) {
    throw new NotFoundError('Resource membership', itemId);
  }
  if (
    upperNeighborId !== null &&
    !rows.some((r) => r.resourceId === upperNeighborId)
  ) {
    throw new NotFoundError('Pivot resource', upperNeighborId);
  }

  const reordered = reorderByUpperNeighbor({
    list: rows,
    getKey: (r) => r.resourceId,
    movedKey: itemId,
    upperNeighborKey: upperNeighborId,
  });
  if (reordered === rows) {
    return null;
  }

  const updates: Array<{ id: string; sortOrder: number }> = [];
  for (let i = 0; i < reordered.length; i++) {
    const row = reordered[i]!;
    if (row.sortOrder !== i) {
      updates.push({ id: row.id, sortOrder: i });
    }
  }
  return { updates };
};

// Two-pass via a negative range: PG's per-row unique index check on
// (collection_id, sort_order) makes a single CASE-WHEN swap collide
// (A:0→1 fights B:1→…). Park in negatives, then write finals.
export const applySortOrderUpdates = async ({
  tx,
  table,
  updates,
}: {
  tx: Transaction;
  table: PgTable;
  updates: Array<{ id: string; sortOrder: number }>;
}): Promise<void> => {
  if (updates.length === 0) {
    return;
  }
  const ids = updates.map((u) => u.id);
  const idList = sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql.raw(', '),
  );

  await tx.execute(sql`
    UPDATE ${table}
    SET sort_order = -1 - sort_order
    WHERE id IN (${idList})
  `);

  const caseSql = sql.join(
    [
      sql`CASE`,
      ...updates.map(
        (u) => sql`WHEN id = ${u.id}::uuid THEN ${u.sortOrder}::integer`,
      ),
      sql`END`,
    ],
    sql.raw(' '),
  );

  await tx.execute(sql`
    UPDATE ${table}
    SET sort_order = ${caseSql}
    WHERE id IN (${idList})
  `);
};

export const findCollectionItem = async ({
  tx,
  collectionId,
  resourceId,
}: {
  tx: DbOrTx;
  collectionId: string;
  resourceId: string;
}) => {
  const [row] = await tx
    .select()
    .from(resourceCollectionItems)
    .where(
      and(
        eq(resourceCollectionItems.collectionId, collectionId),
        eq(resourceCollectionItems.resourceId, resourceId),
      ),
    )
    .limit(1);
  return row ?? null;
};
