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

  it('inserts at an explicit sort slot via upperNeighborId (drop-at-position)', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });

    // New resources land at the top, so after these two the order is
    // [second, first].
    const first = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'First',
      linkUrl: PUBLIC_URL,
    });
    const second = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Second',
      linkUrl: SECOND_PUBLIC_URL,
    });

    // Drop a third directly below `second` → [second, third, first].
    const third = await adminCaller.resources.createLink({
      target: { kind: 'collection', collectionId: first.collectionId },
      title: 'Third',
      linkUrl: 'https://example.net/third',
      upperNeighborId: second.id,
    });

    const after = await adminCaller.resources.listByCollection({
      collectionId: first.collectionId,
    });
    expect(after.items.map((r: ResourceInCollectionDTO) => r.id)).toEqual([
      second.id,
      third.id,
      first.id,
    ]);
  });

  it('inserts at the top when upperNeighborId is null', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });
    const first = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'First',
      linkUrl: PUBLIC_URL,
    });
    const top = await adminCaller.resources.createLink({
      target: { kind: 'collection', collectionId: first.collectionId },
      title: 'Top',
      linkUrl: SECOND_PUBLIC_URL,
      upperNeighborId: null,
    });

    const after = await adminCaller.resources.listByCollection({
      collectionId: first.collectionId,
    });
    expect(after.items.map((r: ResourceInCollectionDTO) => r.id)).toEqual([
      top.id,
      first.id,
    ]);
  });

  it('inserts at the top when upperNeighborId is omitted (Add Resource / first drop into empty panel)', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });
    const first = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'First',
      linkUrl: PUBLIC_URL,
    });
    // Omitting upperNeighborId entirely (undefined, not null) must still land
    // at the top — this is the Add Resource form path and the first file of a
    // multi-file drop into an empty panel.
    const top = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Top',
      linkUrl: SECOND_PUBLIC_URL,
    });
    expect(top.collectionId).toBe(first.collectionId);

    const after = await adminCaller.resources.listByCollection({
      collectionId: first.collectionId,
    });
    expect(after.items.map((r: ResourceInCollectionDTO) => r.id)).toEqual([
      top.id,
      first.id,
    ]);
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

// resources.list coverage lives in list.test.ts.
describe('resources.listByCollection', () => {
  it('listByCollection rejects an outsider', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });
    const collection = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Admin-only',
    });
    const { caller: outsiderCaller } = await createOutsiderCaller(testData);

    await expect(
      outsiderCaller.resources.listByCollection({
        collectionId: collection.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});

describe('resources.createDocument (auth)', () => {
  // The full happy-path needs a real Supabase storage object; here we exercise
  // the procedure boundary (input validation + access control) so the C8 fixes
  // — outsider rejection, non-admin rejection — have explicit coverage.

  it('rejects an outsider from createDocument on a profile target', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, instance } = await setupInstance({
      task,
      onTestFinished,
    });
    const { caller: outsiderCaller } = await createOutsiderCaller(testData);

    await expect(
      outsiderCaller.resources.createDocument({
        target: { kind: 'profile', profileId: instance.profileId },
        title: 'Doc',
        storagePath:
          'profile/00000000-0000-0000-0000-000000000000/resources/doc.pdf',
        fileName: 'doc.pdf',
        mimeType: 'application/pdf',
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });

  it('rejects a non-admin member from createDocument', async ({
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
      memberCaller.resources.createDocument({
        target: { kind: 'profile', profileId: instance.profileId },
        title: 'Doc',
        storagePath:
          'profile/00000000-0000-0000-0000-000000000000/resources/doc.pdf',
        fileName: 'doc.pdf',
        mimeType: 'application/pdf',
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });

  it('rejects an outsider from uploadFile on a profile target', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, instance } = await setupInstance({
      task,
      onTestFinished,
    });
    const { caller: outsiderCaller } = await createOutsiderCaller(testData);

    await expect(
      outsiderCaller.resources.uploadFile({
        target: { kind: 'profile', profileId: instance.profileId },
        fileName: 'tiny.pdf',
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
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
    });
    const created = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Original',
      linkUrl: PUBLIC_URL,
    });

    const updated = await adminCaller.resources.update({
      id: created.id,
      data: { title: 'Renamed' },
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
    });
    const created = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Public',
      linkUrl: PUBLIC_URL,
    });

    await expect(
      adminCaller.resources.update({
        id: created.id,
        data: { linkUrl: 'http://192.168.0.1/private' },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects a non-admin member from updating a resource', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, setup, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });
    const created = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Admin-only',
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
        data: { title: 'Hijack' },
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects an outsider from updating a resource', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });
    const created = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Admin-only',
      linkUrl: PUBLIC_URL,
    });

    const { caller: outsiderCaller } = await createOutsiderCaller(testData);
    await expect(
      outsiderCaller.resources.update({
        id: created.id,
        data: { title: 'Hijack' },
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
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
    expect(after.items.map((r: ResourceInCollectionDTO) => r.id)).toEqual([
      first.id,
      second.id,
    ]);
  });

  it('rejects a non-admin member from reordering resources', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, setup, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
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
    });

    await expect(
      memberCaller.resources.reorder({
        id: created.id,
        collectionId: created.collectionId,
        upperNeighborId: null,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
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
      inOriginal.items.find(
        (r: ResourceInCollectionDTO) => r.id === created.id,
      ),
    ).toBeTruthy();
    const inSecond = await adminCaller.resources.listByCollection({
      collectionId: secondCollection.id,
    });
    expect(
      inSecond.items.find((r: ResourceInCollectionDTO) => r.id === created.id),
    ).toBeTruthy();
  });

  it('concurrent attaches to the same (resource, collection) leave exactly one membership row (P1 race fix)', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
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

  it('rejects a non-admin member from attaching to a collection', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, setup, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
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
    });

    await expect(
      memberCaller.resources.attachToCollection({
        id: created.id,
        collectionId: secondCollection.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
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

    await adminCaller.resources.detachFromCollection({
      id: created.id,
      collectionId: otherCollection.id,
    });

    // Resource is still alive (still in the original Default collection).
    expect(await resourceExists(created.id)).toBe(true);

    const stillInOriginal = await adminCaller.resources.listByCollection({
      collectionId: created.collectionId,
    });
    expect(
      stillInOriginal.items.find(
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
    });

    const created = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Only home',
      linkUrl: PUBLIC_URL,
    });

    await adminCaller.resources.detachFromCollection({
      id: created.id,
      collectionId: created.collectionId,
    });

    // P2: last-detach cascades the resource row itself.
    expect(await resourceExists(created.id)).toBe(false);
  });

  it('rejects a non-admin member from detaching from a collection', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, setup, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
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
    });

    await expect(
      memberCaller.resources.detachFromCollection({
        id: created.id,
        collectionId: created.collectionId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
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

    await adminCaller.resources.delete({ id: created.id });
    expect(await resourceExists(created.id)).toBe(false);

    const inOriginal = await adminCaller.resources.listByCollection({
      collectionId: created.collectionId,
    });
    expect(
      inOriginal.items.find(
        (r: ResourceInCollectionDTO) => r.id === created.id,
      ),
    ).toBeUndefined();
    const inSecond = await adminCaller.resources.listByCollection({
      collectionId: secondCollection.id,
    });
    expect(
      inSecond.items.find((r: ResourceInCollectionDTO) => r.id === created.id),
    ).toBeUndefined();
  });

  it('rejects a non-admin member from deleting a resource', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, setup, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });
    const created = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Admin-only',
      linkUrl: PUBLIC_URL,
    });

    const { caller: memberCaller } = await createMemberCaller({
      testData,
      setup,
      instanceProfileId: instance.profileId,
    });

    await expect(
      memberCaller.resources.delete({ id: created.id }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    expect(await resourceExists(created.id)).toBe(true);
  });
});

describe('resources.listByCollection pagination', () => {
  it('paginates via the cursor: limit yields a next cursor, the second page returns the rest', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });

    const created = await Promise.all([
      adminCaller.resources.createLink({
        target: { kind: 'profile', profileId: instance.profileId },
        title: 'One',
        linkUrl: PUBLIC_URL,
      }),
      adminCaller.resources.createLink({
        target: { kind: 'profile', profileId: instance.profileId },
        title: 'Two',
        linkUrl: SECOND_PUBLIC_URL,
      }),
      adminCaller.resources.createLink({
        target: { kind: 'profile', profileId: instance.profileId },
        title: 'Three',
        linkUrl: 'https://example.net/third',
      }),
    ]);
    const allIds = new Set(created.map((r) => r.id));
    const collectionId = created[0]!.collectionId;

    const firstPage = await adminCaller.resources.listByCollection({
      collectionId,
      limit: 2,
    });
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.next).toBeTruthy();

    const secondPage = await adminCaller.resources.listByCollection({
      collectionId,
      limit: 2,
      cursor: firstPage.next,
    });
    expect(secondPage.items).toHaveLength(1);
    // End of the list — no further cursor.
    expect(secondPage.next).toBeNull();

    // The two pages together cover every created resource with no overlap.
    const pagedIds = [
      ...firstPage.items.map((r: ResourceInCollectionDTO) => r.id),
      ...secondPage.items.map((r: ResourceInCollectionDTO) => r.id),
    ];
    expect(new Set(pagedIds)).toEqual(allIds);
    expect(pagedIds).toHaveLength(allIds.size);
  });
});

describe('resources.update description', () => {
  it('clears the description when null is passed (distinct from undefined no-op)', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });
    const created = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Described',
      description: 'a description',
      linkUrl: PUBLIC_URL,
    });
    expect(created.description).toBe('a description');

    const cleared = await adminCaller.resources.update({
      id: created.id,
      data: { description: null },
    });
    expect(cleared.description).toBeNull();
  });
});
