import { db, eq, inArray } from '@op/db/client';
import {
  resourceCollectionProfiles,
  resourceCollections,
  users,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import { createAuthenticatedCaller } from '../../test/supabase-utils';

type CollectionDTO = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
};

const requireFirstInstance = <T extends { profileId: string }>(
  instances: T[],
): T => {
  const instance = instances[0];
  if (!instance) {
    throw new Error('No instance created');
  }
  return instance;
};

/**
 * Pins the user's currentProfileId to a decision instance so that
 * `getCurrentProfileId(authUserId)` returns it. switchProfile only allows
 * org/individual profiles, so we hit the row directly for instance profiles.
 */
const pinCurrentProfile = async (email: string, profileId: string) => {
  await db
    .update(users)
    .set({ currentProfileId: profileId })
    .where(eq(users.email, email));
};

const registerCleanup = (
  onTestFinished: (fn: () => void | Promise<void>) => void,
  profileIds: string[],
) => {
  onTestFinished(async () => {
    if (profileIds.length === 0) {
      return;
    }
    const collections = await db
      .select({ id: resourceCollectionProfiles.collectionId })
      .from(resourceCollectionProfiles)
      .where(inArray(resourceCollectionProfiles.profileId, profileIds));

    if (collections.length > 0) {
      await db.delete(resourceCollections).where(
        inArray(
          resourceCollections.id,
          collections.map((row) => row.id),
        ),
      );
    }
  });
};

describe('resources.collections.list', () => {
  it('returns an empty list when the instance has no collections', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = requireFirstInstance(setup.instances);
    registerCleanup(onTestFinished, [instance.profileId]);

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    const rows = await adminCaller.resources.collections.list({
      profileId: instance.profileId,
    });
    expect(rows).toEqual([]);
  });

  it('lets a non-admin member READ the collections list', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = requireFirstInstance(setup.instances);
    registerCleanup(onTestFinished, [instance.profileId]);

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Admin Created',
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    const rows = await memberCaller.resources.collections.list({
      profileId: instance.profileId,
    });
    expect(rows.map((r: CollectionDTO) => r.name)).toContain('Admin Created');
  });

  it('rejects outsiders from listing collections on a decision instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = requireFirstInstance(setup.instances);
    registerCleanup(onTestFinished, [instance.profileId]);

    const outsiderSetup = await testData.createDecisionSetup({
      instanceCount: 0,
    });
    const outsider = await testData.createMemberUser({
      organization: outsiderSetup.organization,
      instanceProfileIds: [],
    });
    const outsiderCaller = await createAuthenticatedCaller(outsider.email);

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
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = requireFirstInstance(setup.instances);
    registerCleanup(onTestFinished, [instance.profileId]);

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

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
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = requireFirstInstance(setup.instances);
    registerCleanup(onTestFinished, [instance.profileId]);

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

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
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = requireFirstInstance(setup.instances);
    registerCleanup(onTestFinished, [instance.profileId]);

    const outsiderSetup = await testData.createDecisionSetup({
      instanceCount: 0,
    });
    const outsider = await testData.createMemberUser({
      organization: outsiderSetup.organization,
      instanceProfileIds: [],
    });
    const outsiderCaller = await createAuthenticatedCaller(outsider.email);

    await expect(
      outsiderCaller.resources.collections.create({
        profileId: instance.profileId,
        name: 'Outsider Try',
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });
});

describe('resources.collections.update', () => {
  it('renames a collection and bumps updatedAt on the join row (P3a)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = requireFirstInstance(setup.instances);
    registerCleanup(onTestFinished, [instance.profileId]);

    // updateCollection reads currentProfileId; pin it to the instance.
    await pinCurrentProfile(setup.userEmail, instance.profileId);

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const created = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Original',
    });
    // now() resolution is sub-ms but transaction-bound; wait so the bump can
    // be observed as a strict inequality rather than equality.
    await new Promise((r) => setTimeout(r, 50));

    const updated = await adminCaller.resources.collections.update({
      id: created.id,
      patch: { name: 'Renamed' },
    });

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Renamed');
    expect(updated.updatedAt).toBeTruthy();
    expect(updated.createdAt).toBeTruthy();
    expect(new Date(updated.updatedAt as string).getTime()).toBeGreaterThan(
      new Date(updated.createdAt as string).getTime(),
    );
  });

  it('rejects updating a collection the caller does not own', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = requireFirstInstance(setup.instances);
    registerCleanup(onTestFinished, [instance.profileId]);

    await pinCurrentProfile(setup.userEmail, instance.profileId);
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const created = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Owner-only',
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    await pinCurrentProfile(member.email, instance.profileId);
    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.resources.collections.update({
        id: created.id,
        patch: { name: 'Hijack' },
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });
});

describe('resources.collections.reorder', () => {
  it('moves a collection to the top via a null upper neighbor', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = requireFirstInstance(setup.instances);
    registerCleanup(onTestFinished, [instance.profileId]);

    await pinCurrentProfile(setup.userEmail, instance.profileId);
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

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

    // Move B to the top.
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
});

describe('resources.collections.delete', () => {
  it('deletes a collection and removes it from the list', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = requireFirstInstance(setup.instances);
    registerCleanup(onTestFinished, [instance.profileId]);

    await pinCurrentProfile(setup.userEmail, instance.profileId);
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

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

  it('rejects a non-admin member from deleting a collection', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = requireFirstInstance(setup.instances);
    registerCleanup(onTestFinished, [instance.profileId]);

    await pinCurrentProfile(setup.userEmail, instance.profileId);
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const created = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Protected',
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    await pinCurrentProfile(member.email, instance.profileId);
    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.resources.collections.delete({ id: created.id }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });
});
