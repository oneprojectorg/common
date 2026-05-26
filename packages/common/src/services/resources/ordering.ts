import type { db as dbType } from '@op/db/client';
import { resourceCollectionItems } from '@op/db/schema';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';

import { NotFoundError } from '../../utils/error';
import { reorderByUpperNeighbor } from '../../utils/reorder';

type Transaction = Parameters<Parameters<typeof dbType.transaction>[0]>[0];
export type DbOrTx = typeof dbType | Transaction;

// Serializes concurrent ordering updates within a single collection for the
// lifetime of the surrounding transaction.
export const lockCollection = async (
  tx: Transaction,
  collectionId: string,
): Promise<void> => {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${'resources:' + collectionId}))`,
  );
};

// New items go to the top: shift every existing item's sortOrder up by one
// and the caller inserts at 0. A single `sort_order + 1` UPDATE trips the
// per-row unique index on (collection_id, sort_order) — row 0 tries to
// become 1 while row 1 still holds 1. Park values in a negative range
// first (same trick as applySortOrderUpdates) so the second pass settles
// into the final positive slots without collisions.
export const shiftSortOrderForInsertAtTop = async (
  tx: Transaction,
  collectionId: string,
): Promise<void> => {
  await tx
    .update(resourceCollectionItems)
    .set({ sortOrder: sql`-1 - ${resourceCollectionItems.sortOrder}` })
    .where(eq(resourceCollectionItems.collectionId, collectionId));

  await tx
    .update(resourceCollectionItems)
    .set({ sortOrder: sql`-${resourceCollectionItems.sortOrder}` })
    .where(eq(resourceCollectionItems.collectionId, collectionId));
};

// Computes target sortOrders for the moved item plus any neighbors that need
// to shift. Caller writes the values inside a transaction holding
// lockCollection so concurrent writers serialize and each re-interprets
// upperNeighborId against the freshly-restriped state.
export const computeReorder = async (
  tx: Transaction,
  collectionId: string,
  itemId: string,
  upperNeighborId: string | null,
): Promise<{ updates: Array<{ id: string; sortOrder: number }> } | null> => {
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

  const reordered = reorderByUpperNeighbor(
    rows,
    (r) => r.resourceId,
    itemId,
    upperNeighborId,
  );
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

// Bulk-apply per-row sortOrder updates without N round trips.
//
// PostgreSQL checks the unique index on (collection_id, sort_order) per-row
// during an UPDATE, so a single CASE-WHEN statement that swaps two rows
// (e.g. A:0->1, B:1->0) collides at the first row update before the second
// settles. We dodge that by parking every affected row in a negative range
// first (uniqueness still holds, no value collides with non-updated rows),
// then writing the final values in a second pass.
export const applySortOrderUpdates = async (
  tx: Transaction,
  table: PgTable,
  updates: Array<{ id: string; sortOrder: number }>,
): Promise<void> => {
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

// Returns the resource-collection-item row for a single (collection, resource)
// pair, used by movers/deleters that need to inspect membership.
export const findCollectionItem = async (
  tx: DbOrTx,
  collectionId: string,
  resourceId: string,
) => {
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
