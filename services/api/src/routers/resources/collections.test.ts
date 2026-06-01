import { db, eq } from '@op/db/client';
import { resourceCollectionProfiles } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import {
  createMemberCaller,
  createOutsiderCaller,
  setupInstance,
} from '../../test/helpers/resourcesTestUtils';

type CollectionDTO = {
  id: string;
  name: string;
  sortKey: string;
  createdAt: string | null;
  updatedAt: string | null;
};

describe('resources.collections.list', () => {
  it('returns an empty list when the instance has no collections', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });

    const rows = await adminCaller.resources.collections.list({
      profileId: instance.profileId,
    });
    expect(rows.items).toEqual([]);
    expect(rows.next).toBeNull();
  });

  it('lets a non-admin member READ the collections list', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, setup, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });
    await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Admin Created',
    });

    const { caller: memberCaller } = await createMemberCaller({
      testData,
      setup,
      instanceProfileId: instance.profileId,
    });

    const rows = await memberCaller.resources.collections.list({
      profileId: instance.profileId,
    });
    expect(rows.items.map((r: CollectionDTO) => r.name)).toContain(
      'Admin Created',
    );
  });

  it('rejects outsiders from listing collections on a decision instance', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, instance } = await setupInstance({
      task,
      onTestFinished,
    });
    const { caller: outsiderCaller } = await createOutsiderCaller(testData);

    await expect(
      outsiderCaller.resources.collections.list({
        profileId: instance.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });
});

describe('resources.collections.create', () => {
  it('lets an admin create collections and appends them in creation order', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });

    const first = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'First',
    });
    expect(first.name).toBe('First');
    expect(typeof first.sortKey).toBe('string');

    const second = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Second',
    });
    expect(second.id).not.toBe(first.id);
    // createCollection appends at the tail — `second` sorts after `first`.
    expect(first.sortKey < second.sortKey).toBe(true);
  });

  it('rejects a non-admin member from creating a collection', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, setup, instance } = await setupInstance({
      task,
      onTestFinished,
    });
    const { caller: memberCaller } = await createMemberCaller({
      testData,
      setup,
      instanceProfileId: instance.profileId,
    });

    await expect(
      memberCaller.resources.collections.create({
        profileId: instance.profileId,
        name: 'Member Try',
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });

  it('rejects an outsider from creating a collection', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, instance } = await setupInstance({
      task,
      onTestFinished,
    });
    const { caller: outsiderCaller } = await createOutsiderCaller(testData);

    await expect(
      outsiderCaller.resources.collections.create({
        profileId: instance.profileId,
        name: 'Outsider Try',
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });
});

describe('resources.collections.update', () => {
  it('renames a collection and bumps the join-row updatedAt (P3a)', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });

    const created = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Original',
    });

    const beforeRow = await db
      .select({ updatedAt: resourceCollectionProfiles.updatedAt })
      .from(resourceCollectionProfiles)
      .where(eq(resourceCollectionProfiles.collectionId, created.id))
      .limit(1);
    const beforeUpdatedAt = beforeRow[0]?.updatedAt;
    if (!beforeUpdatedAt) {
      throw new Error('Failed to read pre-update join-row updatedAt');
    }

    const updated = await adminCaller.resources.collections.update({
      id: created.id,
      data: { name: 'Renamed' },
    });

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Renamed');
    expect(updated.updatedAt).toBeTruthy();

    const afterRow = await db
      .select({ updatedAt: resourceCollectionProfiles.updatedAt })
      .from(resourceCollectionProfiles)
      .where(eq(resourceCollectionProfiles.collectionId, created.id))
      .limit(1);
    const afterUpdatedAt = afterRow[0]?.updatedAt;
    if (!afterUpdatedAt) {
      throw new Error('Failed to read post-update join-row updatedAt');
    }
    // Direct on the join row — no sleep, no DTO timestamp coercion. The
    // service's `set({ updatedAt: sql\`now()\` })` must produce a strictly
    // greater timestamp than the initial insert's now().
    expect(new Date(afterUpdatedAt).getTime()).toBeGreaterThan(
      new Date(beforeUpdatedAt).getTime(),
    );
  });

  it('rejects a non-admin member from updating a collection', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, setup, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });
    const created = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Admin-only',
    });

    const { caller: memberCaller } = await createMemberCaller({
      testData,
      setup,
      instanceProfileId: instance.profileId,
    });

    await expect(
      memberCaller.resources.collections.update({
        id: created.id,
        data: { name: 'Hijack' },
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects an outsider from updating a collection', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });
    const created = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Admin-only',
    });

    const { caller: outsiderCaller } = await createOutsiderCaller(testData);
    await expect(
      outsiderCaller.resources.collections.update({
        id: created.id,
        data: { name: 'Hijack' },
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});

describe('resources.collections.reorder', () => {
  it('moves a collection to the top via a null upper neighbor', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });

    const a = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'A',
    });
    const b = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'B',
    });
    expect(a.sortKey < b.sortKey).toBe(true);

    const reordered = await adminCaller.resources.collections.reorder({
      id: b.id,
      upperNeighborId: null,
    });
    expect(reordered.id).toBe(b.id);
    expect(reordered.sortKey < a.sortKey).toBe(true);

    const rows = await adminCaller.resources.collections.list({
      profileId: instance.profileId,
    });
    expect(rows.items.map((r: CollectionDTO) => r.id)).toEqual([b.id, a.id]);
  });

  it('rejects a non-admin member from reordering collections', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, setup, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });
    const created = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'A',
    });
    const { caller: memberCaller } = await createMemberCaller({
      testData,
      setup,
      instanceProfileId: instance.profileId,
    });

    await expect(
      memberCaller.resources.collections.reorder({
        id: created.id,
        upperNeighborId: null,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects an outsider from reordering collections', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });
    const created = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'A',
    });
    const { caller: outsiderCaller } = await createOutsiderCaller(testData);
    await expect(
      outsiderCaller.resources.collections.reorder({
        id: created.id,
        upperNeighborId: null,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});

describe('resources.collections.delete', () => {
  it('deletes a collection and removes it from the list', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });

    const created = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Doomed',
    });

    await adminCaller.resources.collections.delete({
      collectionId: created.id,
    });

    const after = await adminCaller.resources.collections.list({
      profileId: instance.profileId,
    });
    expect(
      after.items.find((r: CollectionDTO) => r.id === created.id),
    ).toBeUndefined();
  });

  it('rejects a non-admin member from deleting a collection', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, setup, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });
    const created = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Protected',
    });

    const { caller: memberCaller } = await createMemberCaller({
      testData,
      setup,
      instanceProfileId: instance.profileId,
    });

    await expect(
      memberCaller.resources.collections.delete({ collectionId: created.id }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});
