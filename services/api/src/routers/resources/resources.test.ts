import { db, eq, inArray } from '@op/db/client';
import {
  resourceCollectionItems,
  resourceCollectionProfiles,
  resourceCollections,
  resources,
  users,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import { createAuthenticatedCaller } from '../../test/supabase-utils';

type ResourceInCollectionDTO = {
  id: string;
  type: 'link' | 'document';
  title: string;
  collectionId: string;
  sortOrder: number;
  linkUrl: string | null;
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
    // Any resources still alive in our collections need to go before the
    // collections are deleted — otherwise the resource rows stay behind
    // (resources don't reference collections, so collection cascade can't
    // reach them).
    const collectionRows = await db
      .select({ id: resourceCollectionProfiles.collectionId })
      .from(resourceCollectionProfiles)
      .where(inArray(resourceCollectionProfiles.profileId, profileIds));

    if (collectionRows.length === 0) {
      return;
    }

    const collectionIds = collectionRows.map((row) => row.id);

    const items = await db
      .select({ resourceId: resourceCollectionItems.resourceId })
      .from(resourceCollectionItems)
      .where(inArray(resourceCollectionItems.collectionId, collectionIds));

    if (items.length > 0) {
      await db.delete(resources).where(
        inArray(
          resources.id,
          items.map((row) => row.resourceId),
        ),
      );
    }

    await db
      .delete(resourceCollections)
      .where(inArray(resourceCollections.id, collectionIds));
  });
};

const resourceExists = async (id: string): Promise<boolean> => {
  const [row] = await db
    .select({ id: resources.id })
    .from(resources)
    .where(eq(resources.id, id))
    .limit(1);
  return Boolean(row);
};

const PUBLIC_URL = 'https://example.com/article';
const ANOTHER_URL = 'https://example.org/another';

describe('resources.createLink', () => {
  it('creates a link on a profile target and lazily creates the Pinned collection', async ({
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

    const row = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'My Link',
      linkUrl: PUBLIC_URL,
    });

    expect(row.type).toBe('link');
    expect(row.title).toBe('My Link');
    expect(row.linkUrl).toBe(PUBLIC_URL);
    expect(row.collectionId).toBeTruthy();
    expect(row.sortOrder).toBe(0);
  });

  it('creates a link directly into an existing collection target', async ({
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
    const collection = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Articles',
    });

    const row = await adminCaller.resources.createLink({
      target: { kind: 'collection', collectionId: collection.id },
      title: 'Article 1',
      linkUrl: PUBLIC_URL,
    });

    expect(row.collectionId).toBe(collection.id);
    expect(row.sortOrder).toBe(0);
  });

  it('rejects loopback URLs (SSRF guard)', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = requireFirstInstance(setup.instances);
    registerCleanup(onTestFinished, [instance.profileId]);

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      adminCaller.resources.createLink({
        target: { kind: 'profile', profileId: instance.profileId },
        title: 'Loopback',
        linkUrl: 'http://127.0.0.1:8080/internal',
      }),
    ).rejects.toThrow();

    await expect(
      adminCaller.resources.createLink({
        target: { kind: 'profile', profileId: instance.profileId },
        title: 'RFC1918',
        linkUrl: 'http://10.0.0.1/secret',
      }),
    ).rejects.toThrow();
  });

  it('rejects a non-admin member from creating a link', async ({
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
      memberCaller.resources.createLink({
        target: { kind: 'profile', profileId: instance.profileId },
        title: 'Member Try',
        linkUrl: PUBLIC_URL,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });

  it('rejects an outsider from creating a link', async ({
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
      outsiderCaller.resources.createLink({
        target: { kind: 'profile', profileId: instance.profileId },
        title: 'Outsider Try',
        linkUrl: PUBLIC_URL,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });
});

describe('resources.list / listByCollection', () => {
  it('list returns resources in the lazily-created Pinned collection', async ({
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
    const created = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Listed',
      linkUrl: PUBLIC_URL,
    });

    const result = await adminCaller.resources.list({
      profileId: instance.profileId,
    });
    expect(result.collectionId).toBe(created.collectionId);
    expect(
      result.resources.map((r: ResourceInCollectionDTO) => r.id),
    ).toContain(created.id);
  });

  it('listByCollection requires the caller to own the collection', async ({
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
    const collection = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Owner-only',
    });

    const outsiderSetup = await testData.createDecisionSetup({
      instanceCount: 0,
    });
    const outsider = await testData.createMemberUser({
      organization: outsiderSetup.organization,
      instanceProfileIds: [],
    });
    const outsiderCaller = await createAuthenticatedCaller(outsider.email);

    await expect(
      outsiderCaller.resources.listByCollection({
        collectionId: collection.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});

describe('resources.update', () => {
  it('updates a link resource title for an admin', async ({
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
    const created = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Original',
      linkUrl: PUBLIC_URL,
    });

    const updated = await adminCaller.resources.update({
      id: created.id,
      patch: { title: 'Renamed' },
    });
    expect(updated.title).toBe('Renamed');
    expect(updated.type).toBe('link');
  });

  it('rejects an SSRF linkUrl on update', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = requireFirstInstance(setup.instances);
    registerCleanup(onTestFinished, [instance.profileId]);

    await pinCurrentProfile(setup.userEmail, instance.profileId);
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const created = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Public',
      linkUrl: PUBLIC_URL,
    });

    await expect(
      adminCaller.resources.update({
        id: created.id,
        patch: { linkUrl: 'http://192.168.0.1/private' },
      }),
    ).rejects.toThrow();
  });

  it('rejects a non-admin member from updating a resource', async ({
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
    const created = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Owner-only',
      linkUrl: PUBLIC_URL,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    await pinCurrentProfile(member.email, instance.profileId);
    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.resources.update({
        id: created.id,
        patch: { title: 'Hijack' },
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });
});

describe('resources.reorder', () => {
  it('reorders two resources within a collection', async ({
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

    const first = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'First',
      linkUrl: PUBLIC_URL,
    });
    // Newly created resources insert at sortOrder=0, so `second` will be at 0
    // and `first` will shift to 1.
    const second = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Second',
      linkUrl: ANOTHER_URL,
    });
    expect(first.collectionId).toBe(second.collectionId);

    // Move `first` to the top (sortOrder=0) by passing a null upper neighbor.
    const moved = await adminCaller.resources.reorder({
      id: first.id,
      collectionId: first.collectionId,
      upperNeighborId: null,
    });
    expect(moved.id).toBe(first.id);
    expect(moved.sortOrder).toBe(0);

    const after = await adminCaller.resources.listByCollection({
      collectionId: first.collectionId,
    });
    expect(after.resources.map((r: ResourceInCollectionDTO) => r.id)).toEqual([
      first.id,
      second.id,
    ]);
  });
});

describe('resources.attachToCollection', () => {
  it('attaches a resource to a second collection and is idempotent (P1)', async ({
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

    const created = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Shared',
      linkUrl: PUBLIC_URL,
    });
    const secondCollection = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Other',
    });

    const attached = await adminCaller.resources.attachToCollection({
      id: created.id,
      collectionId: secondCollection.id,
    });
    expect(attached.collectionId).toBe(secondCollection.id);
    expect(attached.sortOrder).toBe(0);

    // Calling attach again must NOT trip the unique index — it should return
    // the existing membership. This exercises the P1 race fix where the
    // existence probe is now inside the lock.
    const reattached = await adminCaller.resources.attachToCollection({
      id: created.id,
      collectionId: secondCollection.id,
    });
    expect(reattached.collectionId).toBe(secondCollection.id);
    expect(reattached.id).toBe(created.id);

    // Both collections still hold the resource.
    const inOriginal = await adminCaller.resources.listByCollection({
      collectionId: created.collectionId,
    });
    expect(
      inOriginal.resources.find(
        (r: ResourceInCollectionDTO) => r.id === created.id,
      ),
    ).toBeTruthy();
    const inSecond = await adminCaller.resources.listByCollection({
      collectionId: secondCollection.id,
    });
    expect(
      inSecond.resources.find(
        (r: ResourceInCollectionDTO) => r.id === created.id,
      ),
    ).toBeTruthy();
  });
});

describe('resources.detachFromCollection (P2 cascade)', () => {
  it('leaves the resource alive when other collection memberships remain', async ({
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

    const created = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Two homes',
      linkUrl: PUBLIC_URL,
    });
    const otherCollection = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Other',
    });
    await adminCaller.resources.attachToCollection({
      id: created.id,
      collectionId: otherCollection.id,
    });

    const result = await adminCaller.resources.detachFromCollection({
      id: created.id,
      collectionId: otherCollection.id,
    });
    expect(result).toEqual({ ok: true });

    // Resource is still alive (still in the original Pinned collection).
    expect(await resourceExists(created.id)).toBe(true);

    const stillInOriginal = await adminCaller.resources.listByCollection({
      collectionId: created.collectionId,
    });
    expect(
      stillInOriginal.resources.find(
        (r: ResourceInCollectionDTO) => r.id === created.id,
      ),
    ).toBeTruthy();
  });

  it('cascade-deletes the resource when detaching from its last collection', async ({
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

    const created = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Only home',
      linkUrl: PUBLIC_URL,
    });

    const result = await adminCaller.resources.detachFromCollection({
      id: created.id,
      collectionId: created.collectionId,
    });
    expect(result).toEqual({ ok: true });

    // P2: last-detach cascades the resource row itself.
    expect(await resourceExists(created.id)).toBe(false);
  });
});

describe('resources.delete', () => {
  it('deletes a resource and removes it from every collection', async ({
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

    const created = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Doomed',
      linkUrl: PUBLIC_URL,
    });
    const secondCollection = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Other',
    });
    await adminCaller.resources.attachToCollection({
      id: created.id,
      collectionId: secondCollection.id,
    });

    const result = await adminCaller.resources.delete({ id: created.id });
    expect(result).toEqual({ ok: true });
    expect(await resourceExists(created.id)).toBe(false);

    const inOriginal = await adminCaller.resources.listByCollection({
      collectionId: created.collectionId,
    });
    expect(
      inOriginal.resources.find(
        (r: ResourceInCollectionDTO) => r.id === created.id,
      ),
    ).toBeUndefined();
    const inSecond = await adminCaller.resources.listByCollection({
      collectionId: secondCollection.id,
    });
    expect(
      inSecond.resources.find(
        (r: ResourceInCollectionDTO) => r.id === created.id,
      ),
    ).toBeUndefined();
  });

  it('rejects a non-admin member from deleting a resource', async ({
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
    const created = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Owner-only',
      linkUrl: PUBLIC_URL,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    await pinCurrentProfile(member.email, instance.profileId);
    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.resources.delete({ id: created.id }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });

    expect(await resourceExists(created.id)).toBe(true);
  });
});
