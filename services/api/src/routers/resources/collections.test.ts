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
  sortOrder: number;
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
    expect(rows).toEqual([]);
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
    expect(rows.map((r: CollectionDTO) => r.name)).toContain('Admin Created');
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
  it('lets an admin create a collection and assigns sortOrder=0 then 1', async ({
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
    expect(first.sortOrder).toBe(0);

    const second = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Second',
    });
    expect(second.sortOrder).toBe(1);
    expect(second.id).not.toBe(first.id);
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
      pinAdmin: true,
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
      patch: { name: 'Renamed' },
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

  it('rejects updating a collection the caller does not own (pinned member → admin policy fails)', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, setup, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
      pinAdmin: true,
    });
    const created = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Owner-only',
    });

    const { caller: memberCaller } = await createMemberCaller({
      testData,
      setup,
      instanceProfileId: instance.profileId,
      pin: true,
    });

    await expect(
      memberCaller.resources.collections.update({
        id: created.id,
        patch: { name: 'Hijack' },
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });

  it('rejects an unpinned member updating a collection (realistic flow → NotFoundError on individual profile scope)', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, setup, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
      pinAdmin: true,
    });
    const created = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Owner-only',
    });

    // No pinning: getCurrentProfileId returns the member's individual profile,
    // which lenient-passes the DECISION policy and then doesn't own the
    // collection — yielding NotFoundError, not AccessControlException.
    const { caller: memberCaller } = await createMemberCaller({
      testData,
      setup,
      instanceProfileId: instance.profileId,
    });

    await expect(
      memberCaller.resources.collections.update({
        id: created.id,
        patch: { name: 'Hijack' },
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('rejects an outsider from updating a collection', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
      pinAdmin: true,
    });
    const created = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Owner-only',
    });

    const { caller: outsiderCaller } = await createOutsiderCaller(testData);
    await expect(
      outsiderCaller.resources.collections.update({
        id: created.id,
        patch: { name: 'Hijack' },
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
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
      pinAdmin: true,
    });

    const a = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'A',
    });
    const b = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'B',
    });
    expect(a.sortOrder).toBe(0);
    expect(b.sortOrder).toBe(1);

    const reordered = await adminCaller.resources.collections.reorder({
      id: b.id,
      upperNeighborId: null,
    });
    expect(reordered.id).toBe(b.id);
    expect(reordered.sortOrder).toBe(0);

    const rows = await adminCaller.resources.collections.list({
      profileId: instance.profileId,
    });
    expect(rows.map((r: CollectionDTO) => r.id)).toEqual([b.id, a.id]);
  });

  it('rejects a pinned member from reordering collections', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, setup, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
      pinAdmin: true,
    });
    const created = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'A',
    });
    const { caller: memberCaller } = await createMemberCaller({
      testData,
      setup,
      instanceProfileId: instance.profileId,
      pin: true,
    });

    await expect(
      memberCaller.resources.collections.reorder({
        id: created.id,
        upperNeighborId: null,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });

  it('rejects an outsider from reordering collections', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
      pinAdmin: true,
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
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
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
      pinAdmin: true,
    });

    const created = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Doomed',
    });

    const result = await adminCaller.resources.collections.delete({
      id: created.id,
    });
    expect(result).toEqual({ ok: true });

    const after = await adminCaller.resources.collections.list({
      profileId: instance.profileId,
    });
    expect(
      after.find((r: CollectionDTO) => r.id === created.id),
    ).toBeUndefined();
  });

  it('rejects a pinned non-admin member from deleting a collection', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, setup, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
      pinAdmin: true,
    });
    const created = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Protected',
    });

    const { caller: memberCaller } = await createMemberCaller({
      testData,
      setup,
      instanceProfileId: instance.profileId,
      pin: true,
    });

    await expect(
      memberCaller.resources.collections.delete({ id: created.id }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });
});
