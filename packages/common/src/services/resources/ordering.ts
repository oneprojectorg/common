import type { db as dbType } from '@op/db/client';
import { resourceCollectionItems } from '@op/db/schema';
import { and, asc, eq, sql } from 'drizzle-orm';

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
// and the caller inserts at 0.
export const shiftSortOrderForInsertAtTop = async (
  tx: Transaction,
  collectionId: string,
): Promise<void> => {
  await tx
    .update(resourceCollectionItems)
    .set({ sortOrder: sql`${resourceCollectionItems.sortOrder} + 1` })
    .where(eq(resourceCollectionItems.collectionId, collectionId));
};

// Computes target sortOrders for the moved item plus the slice of items
// between the moved item's current position and the requested neighbor.
// Caller writes the values inside a transaction holding lockCollection.
export const computeReorder = async (
  tx: Transaction,
  collectionId: string,
  itemId: string,
  beforeId: string | undefined,
  afterId: string | undefined,
): Promise<{ updates: Array<{ id: string; sortOrder: number }> } | null> => {
  if ((beforeId === undefined) === (afterId === undefined)) {
    throw new Error('Exactly one of beforeId / afterId is required');
  }
  if (itemId === beforeId || itemId === afterId) {
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

  const fromIdx = rows.findIndex((r) => r.resourceId === itemId);
  if (fromIdx === -1) {
    throw new Error('Resource not found in collection');
  }
  const moved = rows[fromIdx]!;
  const without = rows.filter((_, i) => i !== fromIdx);

  let toIdx: number;
  if (beforeId !== undefined) {
    toIdx = without.findIndex((r) => r.resourceId === beforeId);
    if (toIdx === -1) {
      throw new Error('Pivot resource not found in collection');
    }
  } else {
    const afterIdx = without.findIndex((r) => r.resourceId === afterId);
    if (afterIdx === -1) {
      throw new Error('Pivot resource not found in collection');
    }
    toIdx = afterIdx + 1;
  }

  const reordered = [
    ...without.slice(0, toIdx),
    moved,
    ...without.slice(toIdx),
  ];

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
export const applySortOrderUpdates = async (
  tx: Transaction,
  updates: Array<{ id: string; sortOrder: number }>,
): Promise<void> => {
  if (updates.length === 0) {
    return;
  }
  // CASE expression keeps everything to a single UPDATE.
  const ids = updates.map((u) => u.id);
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
    UPDATE ${resourceCollectionItems}
    SET sort_order = ${caseSql}
    WHERE id IN (${sql.join(
      ids.map((id) => sql`${id}::uuid`),
      sql.raw(', '),
    )})
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
