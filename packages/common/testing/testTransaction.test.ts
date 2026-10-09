import { db, eq } from '@op/db/client';
import { EntityType, profiles } from '@op/db/schema';
import { afterTestTransaction, inTestTransaction, realDb } from '@op/db/test';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const readById = (client: typeof realDb, id: string) =>
  client.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, id));

const insertProfile = (client: typeof realDb, suffix: string) =>
  client
    .insert(profiles)
    .values({
      name: `tx proof ${suffix}`,
      slug: `tx-proof-${randomUUID()}`,
      type: EntityType.INDIVIDUAL,
    })
    .returning({ id: profiles.id })
    .then(([row]) => {
      if (!row) {
        throw new Error('insert returned no row');
      }
      return row.id;
    });

const handedOver: { id: string | null; afterRollbackSawRow: boolean | null } = {
  id: null,
  afterRollbackSawRow: null,
};

describe('a test runs inside a transaction', () => {
  it('writes through db are visible to the test and invisible to the pool while it runs', async () => {
    expect(inTestTransaction()).toBe(true);
    const id = await insertProfile(db, 'visible');

    expect(await readById(db, id)).toEqual([{ id }]);
    expect(await readById(realDb, id)).toEqual([]);
  });

  it('a nested db.transaction is a savepoint: its failure keeps the outer rows', async () => {
    const kept = await insertProfile(db, 'kept');

    await expect(
      db.transaction(async (tx) => {
        await insertProfile(tx, 'discarded');
        throw new Error('discard the savepoint');
      }),
    ).rejects.toThrow('discard the savepoint');

    expect(await readById(db, kept)).toEqual([{ id: kept }]);
    const discarded = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.name, 'tx proof discarded'));
    expect(discarded).toEqual([]);
  });

  it.sequential('registers work for after the rollback and hands its row id to the next test', async () => {
    const id = await insertProfile(db, 'handed over');
    handedOver.id = id;
    await afterTestTransaction(async () => {
      handedOver.afterRollbackSawRow = (await readById(realDb, id)).length > 0;
    });
  });

  it.sequential("the previous test's row is gone and its after-rollback hook ran outside the transaction", async () => {
    expect(handedOver.id).not.toBeNull();
    expect(handedOver.afterRollbackSawRow).toBe(false);
    expect(await readById(realDb, handedOver.id ?? '')).toEqual([]);
    expect(await readById(db, handedOver.id ?? '')).toEqual([]);
  });

  it('an onTestFinished delete runs inside the transaction and needs no real row', async ({
    onTestFinished,
  }) => {
    const id = await insertProfile(db, 'finished');
    onTestFinished(async () => {
      expect(inTestTransaction()).toBe(true);
      await db.delete(profiles).where(eq(profiles.id, id));
    });
  });
});
