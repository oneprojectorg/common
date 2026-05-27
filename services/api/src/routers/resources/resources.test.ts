import { and, db, eq } from '@op/db/client';
import { resourceCollectionItems } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import {
  createMemberCaller,
  createOutsiderCaller,
  resourceExists,
  setupInstance,
} from '../../test/helpers/resourcesTestUtils';

type ResourceInCollectionDTO = {
  id: string;
  type: 'link' | 'document';
  title: string;
  collectionId: string;
  sortKey: string;
  linkUrl: string | null;
};

const PUBLIC_URL = 'https://example.com/article';
const SECOND_PUBLIC_URL = 'https://example.org/another';

describe('resources.createLink', () => {
  it('creates a link on a profile target and lazily creates the Default collection', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });

    const row = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'My Link',
      linkUrl: PUBLIC_URL,
    });

    expect(row.type).toBe('link');
    expect(row.title).toBe('My Link');
    expect(row.linkUrl).toBe(PUBLIC_URL);
    expect(row.collectionId).toBeTruthy();
    expect(typeof row.sortKey).toBe('string');
  });

  it('creates a link directly into an existing collection target', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
      pinAdmin: true,
    });
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
    expect(typeof row.sortKey).toBe('string');
  });

  it('rejects private-host URLs via the SSRF guard (BAD_REQUEST)', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });

    // Both should fail at zod validation with TRPCError BAD_REQUEST — the SSRF
    // refinement runs before the service layer, so this also confirms the
    // guard never even attempts the DB write.
    await expect(
      adminCaller.resources.createLink({
        target: { kind: 'profile', profileId: instance.profileId },
        title: 'Loopback',
        linkUrl: 'http://127.0.0.1:8080/internal',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    await expect(
      adminCaller.resources.createLink({
        target: { kind: 'profile', profileId: instance.profileId },
        title: 'RFC1918',
        linkUrl: 'http://10.0.0.1/secret',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects a non-admin member from creating a link', async ({
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
    const { testData, instance } = await setupInstance({
      task,
      onTestFinished,
    });
    const { caller: outsiderCaller } = await createOutsiderCaller(testData);

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
  it('list returns resources in the lazily-created Default collection', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });
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

  it('listByCollection requires the caller to own the collection (UnauthorizedError, not AccessControlException — intentional service-layer choice)', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });
    const collection = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Owner-only',
    });
    const { caller: outsiderCaller } = await createOutsiderCaller(testData);

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
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
      pinAdmin: true,
    });
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

  it('rejects a private-host linkUrl on update (BAD_REQUEST)', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
      pinAdmin: true,
    });
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
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects a pinned non-admin member from updating a resource', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, setup, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
      pinAdmin: true,
    });
    const created = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Owner-only',
      linkUrl: PUBLIC_URL,
    });

    const { caller: memberCaller } = await createMemberCaller({
      testData,
      setup,
      instanceProfileId: instance.profileId,
      pin: true,
    });

    await expect(
      memberCaller.resources.update({
        id: created.id,
        patch: { title: 'Hijack' },
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });

  it('rejects an unpinned member updating a resource (realistic flow → NotFoundError)', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, setup, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
      pinAdmin: true,
    });
    const created = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Owner-only',
      linkUrl: PUBLIC_URL,
    });

    const { caller: memberCaller } = await createMemberCaller({
      testData,
      setup,
      instanceProfileId: instance.profileId,
    });

    await expect(
      memberCaller.resources.update({
        id: created.id,
        patch: { title: 'Hijack' },
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('rejects an outsider from updating a resource', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
      pinAdmin: true,
    });
    const created = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Owner-only',
      linkUrl: PUBLIC_URL,
    });

    const { caller: outsiderCaller } = await createOutsiderCaller(testData);
    await expect(
      outsiderCaller.resources.update({
        id: created.id,
        patch: { title: 'Hijack' },
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });
});

describe('resources.reorder', () => {
  it('reorders two resources within a collection', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
      pinAdmin: true,
    });

    const first = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'First',
      linkUrl: PUBLIC_URL,
    });
    // Newly created resources insert at the top, so `second` lands above
    // `first` initially. The reorder below pushes `first` back to the top.
    const second = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Second',
      linkUrl: SECOND_PUBLIC_URL,
    });
    expect(first.collectionId).toBe(second.collectionId);

    const moved = await adminCaller.resources.reorder({
      id: first.id,
      collectionId: first.collectionId,
      upperNeighborId: null,
    });
    expect(moved.id).toBe(first.id);
    expect(moved.sortKey < second.sortKey).toBe(true);

    const after = await adminCaller.resources.listByCollection({
      collectionId: first.collectionId,
    });
    expect(after.resources.map((r: ResourceInCollectionDTO) => r.id)).toEqual([
      first.id,
      second.id,
    ]);
  });

  it('rejects a pinned member from reordering resources', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, setup, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
      pinAdmin: true,
    });
    const created = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'A',
      linkUrl: PUBLIC_URL,
    });
    const { caller: memberCaller } = await createMemberCaller({
      testData,
      setup,
      instanceProfileId: instance.profileId,
      pin: true,
    });

    await expect(
      memberCaller.resources.reorder({
        id: created.id,
        collectionId: created.collectionId,
        upperNeighborId: null,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });
});

describe('resources.attachToCollection', () => {
  it('attaches a resource to a second collection (happy path)', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
      pinAdmin: true,
    });

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
    expect(typeof attached.sortKey).toBe('string');

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

  it('concurrent attaches to the same (resource, collection) leave exactly one membership row (P1 race fix)', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
      pinAdmin: true,
    });

    const created = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Shared',
      linkUrl: PUBLIC_URL,
    });
    const secondCollection = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Other',
    });

    // Fire two attach calls in parallel — both must succeed without tripping
    // the (collection_id, resource_id) unique index. The service serializes
    // them via the pg advisory lock on the collection.
    const [a, b] = await Promise.all([
      adminCaller.resources.attachToCollection({
        id: created.id,
        collectionId: secondCollection.id,
      }),
      adminCaller.resources.attachToCollection({
        id: created.id,
        collectionId: secondCollection.id,
      }),
    ]);

    expect(a.collectionId).toBe(secondCollection.id);
    expect(b.collectionId).toBe(secondCollection.id);
    expect(a.sortKey).toBe(b.sortKey);

    // Verify the DB really only has one row, not two.
    const rows = await db
      .select({ id: resourceCollectionItems.id })
      .from(resourceCollectionItems)
      .where(
        and(
          eq(resourceCollectionItems.collectionId, secondCollection.id),
          eq(resourceCollectionItems.resourceId, created.id),
        ),
      );
    expect(rows).toHaveLength(1);
  });

  it('rejects a pinned member from attaching to a collection', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, setup, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
      pinAdmin: true,
    });
    const created = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Shared',
      linkUrl: PUBLIC_URL,
    });
    const secondCollection = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Other',
    });

    const { caller: memberCaller } = await createMemberCaller({
      testData,
      setup,
      instanceProfileId: instance.profileId,
      pin: true,
    });

    await expect(
      memberCaller.resources.attachToCollection({
        id: created.id,
        collectionId: secondCollection.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });
});

describe('resources.detachFromCollection (P2 cascade)', () => {
  it('leaves the resource alive when other collection memberships remain', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
      pinAdmin: true,
    });

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

    // Resource is still alive (still in the original Default collection).
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
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
      pinAdmin: true,
    });

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

  it('rejects a pinned member from detaching from a collection', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, setup, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
      pinAdmin: true,
    });
    const created = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'A',
      linkUrl: PUBLIC_URL,
    });
    const { caller: memberCaller } = await createMemberCaller({
      testData,
      setup,
      instanceProfileId: instance.profileId,
      pin: true,
    });

    await expect(
      memberCaller.resources.detachFromCollection({
        id: created.id,
        collectionId: created.collectionId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });
});

describe('resources.delete', () => {
  it('deletes a resource and removes it from every collection', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
      pinAdmin: true,
    });

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

  it('rejects a pinned non-admin member from deleting a resource', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, setup, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
      pinAdmin: true,
    });
    const created = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Owner-only',
      linkUrl: PUBLIC_URL,
    });

    const { caller: memberCaller } = await createMemberCaller({
      testData,
      setup,
      instanceProfileId: instance.profileId,
      pin: true,
    });

    await expect(
      memberCaller.resources.delete({ id: created.id }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });

    expect(await resourceExists(created.id)).toBe(true);
  });
});
