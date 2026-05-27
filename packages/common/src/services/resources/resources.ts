import { db } from '@op/db/client';
import {
  attachments,
  objectsInStorage,
  profileUsers,
  resourceCollectionItems,
  resourceCollectionProfiles,
  resources,
  type Resource,
  type ResourceType,
} from '@op/db/schema';
import { and, asc, eq } from 'drizzle-orm';

import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils/error';
import { getCurrentProfileId } from '../access';
import { assertResourceAccess } from './access';
import { resolveOrCreatePinnedCollection } from './collections';
import { resourcePathPrefix } from './constants';
import {
  applySortOrderUpdates,
  computeReorder,
  findCollectionItem,
  lockCollection,
  shiftSortOrderForInsertAtTop,
} from './ordering';
import {
  type ResourceDto,
  type ResourceInCollectionDto,
  type ResourceListResult,
} from './schemas';
import { deleteResourceObject, getResourceSignedUrl } from './storage';

type LoadedResource = Resource & {
  attachment: {
    storageObjectId: string;
    fileName: string;
    mimeType: string;
    fileSize: number | null;
    storageObject: { name: string | null } | null;
  } | null;
};

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const resourceType = (row: Pick<Resource, 'attachmentId'>): ResourceType =>
  row.attachmentId !== null ? 'document' : 'link';

const toResourceDto = async (row: LoadedResource): Promise<ResourceDto> => {
  const storageObjectName = row.attachment?.storageObject?.name ?? null;
  const signedUrl = storageObjectName
    ? await getResourceSignedUrl(storageObjectName)
    : null;

  const base = {
    id: row.id,
    title: row.title,
    description: row.description,
    addedByProfileUserId: row.addedByProfileUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    signedUrl,
  };

  if (resourceType(row) === 'document') {
    if (!row.attachment || row.attachmentId === null) {
      throw new ConflictError(
        'Resource has document type but missing attachment',
      );
    }
    return {
      ...base,
      type: 'document',
      linkUrl: null,
      attachmentId: row.attachmentId,
      attachment: {
        storageObjectId: row.attachment.storageObjectId,
        fileName: row.attachment.fileName,
        mimeType: row.attachment.mimeType,
        fileSize: row.attachment.fileSize,
      },
    };
  }

  if (row.linkUrl === null) {
    throw new ConflictError('Resource has link type but missing linkUrl');
  }
  return {
    ...base,
    type: 'link',
    linkUrl: row.linkUrl,
    attachmentId: null,
    attachment: null,
  };
};

const loadResourceDtoById = async (id: string): Promise<ResourceDto> => {
  const row = await db.query.resources.findFirst({
    where: { id },
    with: { attachment: { with: { storageObject: true } } },
  });
  if (!row) {
    throw new NotFoundError('Resource', id);
  }
  return toResourceDto(row);
};

const loadResourceInCollectionDto = async ({
  resourceId,
  collectionId,
  sortOrder,
}: {
  resourceId: string;
  collectionId: string;
  sortOrder: number;
}): Promise<ResourceInCollectionDto> => {
  const base = await loadResourceDtoById(resourceId);
  return { ...base, collectionId, sortOrder };
};

const profileOwnsCollection = async ({
  profileId,
  collectionId,
}: {
  profileId: string;
  collectionId: string;
}): Promise<boolean> => {
  const [row] = await db
    .select({ id: resourceCollectionProfiles.id })
    .from(resourceCollectionProfiles)
    .where(
      and(
        eq(resourceCollectionProfiles.profileId, profileId),
        eq(resourceCollectionProfiles.collectionId, collectionId),
      ),
    )
    .limit(1);
  return row !== undefined;
};

const profileOwnsResource = async ({
  profileId,
  resourceId,
}: {
  profileId: string;
  resourceId: string;
}): Promise<boolean> => {
  const [row] = await db
    .select({ id: resourceCollectionItems.id })
    .from(resourceCollectionItems)
    .innerJoin(
      resourceCollectionProfiles,
      eq(
        resourceCollectionProfiles.collectionId,
        resourceCollectionItems.collectionId,
      ),
    )
    .where(
      and(
        eq(resourceCollectionItems.resourceId, resourceId),
        eq(resourceCollectionProfiles.profileId, profileId),
      ),
    )
    .limit(1);
  return row !== undefined;
};

const fetchByCollection = async (
  collectionId: string,
): Promise<ResourceListResult> => {
  const items = await db.query.resourceCollectionItems.findMany({
    where: { collectionId },
    orderBy: { sortOrder: 'asc' },
    with: {
      resource: {
        with: { attachment: { with: { storageObject: true } } },
      },
    },
  });

  const dtos = await Promise.all(
    items.map(async (item) => {
      const base = await toResourceDto(item.resource);
      return { ...base, collectionId, sortOrder: item.sortOrder };
    }),
  );
  return { collectionId, resources: dtos };
};

export const listResources = async ({
  authUserId,
  profileId,
}: {
  authUserId: string;
  profileId: string;
}): Promise<ResourceListResult> => {
  // Try write first so admin callers create the Pinned collection lazily; fall back to read.
  let canWrite = true;
  try {
    await assertResourceAccess({ profileId, authUserId, level: 'write' });
  } catch {
    canWrite = false;
    await assertResourceAccess({ profileId, authUserId, level: 'read' });
  }

  const collection = await resolveOrCreatePinnedCollection({
    profileId,
    createIfMissing: canWrite,
  });
  if (!collection) {
    return { collectionId: null, resources: [] };
  }

  return fetchByCollection(collection.id);
};

export const listResourcesByCollection = async ({
  authUserId,
  collectionId,
}: {
  authUserId: string;
  collectionId: string;
}): Promise<ResourceListResult> => {
  const profileId = await getCurrentProfileId(authUserId);
  await assertResourceAccess({ profileId, authUserId, level: 'read' });
  if (!(await profileOwnsCollection({ profileId, collectionId }))) {
    throw new UnauthorizedError("You don't have access to do this");
  }
  return fetchByCollection(collectionId);
};

const resolveTargetCollection = async ({
  authUserId,
  scope,
}: {
  authUserId: string;
  scope: { profileId?: string; collectionId?: string };
}): Promise<{ collectionId: string; profileId: string }> => {
  const profileId = scope.profileId ?? (await getCurrentProfileId(authUserId));
  await assertResourceAccess({ profileId, authUserId, level: 'write' });

  if (scope.collectionId !== undefined) {
    if (!(await profileOwnsCollection({ profileId, collectionId: scope.collectionId }))) {
      throw new NotFoundError('Collection', scope.collectionId);
    }
    return { collectionId: scope.collectionId, profileId };
  }

  const collection = await resolveOrCreatePinnedCollection({
    profileId,
    createIfMissing: true,
  });
  if (!collection) {
    throw new ConflictError('Failed to resolve collection');
  }
  return { collectionId: collection.id, profileId };
};

const lookupProfileUserId = async ({
  authUserId,
  profileId,
}: {
  authUserId: string;
  profileId: string;
}): Promise<string | null> => {
  const [row] = await db
    .select({ id: profileUsers.id })
    .from(profileUsers)
    .where(
      and(
        eq(profileUsers.authUserId, authUserId),
        eq(profileUsers.profileId, profileId),
      ),
    )
    .limit(1);
  return row?.id ?? null;
};

const insertAtTop = async ({
  tx,
  collectionId,
  resourceId,
  addedByProfileUserId,
}: {
  tx: Transaction;
  collectionId: string;
  resourceId: string;
  addedByProfileUserId: string | null;
}): Promise<number> => {
  await lockCollection({ tx, collectionId });
  await shiftSortOrderForInsertAtTop({ tx, collectionId });
  const [link] = await tx
    .insert(resourceCollectionItems)
    .values({
      collectionId,
      resourceId,
      sortOrder: 0,
      addedByProfileUserId,
    })
    .returning();
  if (!link) {
    throw new ConflictError('Failed to attach resource to collection');
  }
  return link.sortOrder;
};

export type CreateLinkInput = {
  authUserId: string;
  profileId?: string;
  collectionId?: string;
  title: string;
  description: string | null;
  linkUrl: string;
};

export const createLinkResource = async (
  input: CreateLinkInput,
): Promise<ResourceInCollectionDto> => {
  const { collectionId, profileId } = await resolveTargetCollection({
    authUserId: input.authUserId,
    scope: {
      profileId: input.profileId,
      collectionId: input.collectionId,
    },
  });

  const addedByProfileUserId = await lookupProfileUserId({
    authUserId: input.authUserId,
    profileId,
  });

  const { resourceId, sortOrder } = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(resources)
      .values({
        title: input.title,
        description: input.description,
        linkUrl: input.linkUrl,
        addedByProfileUserId,
      })
      .returning();
    if (!row) {
      throw new ConflictError('Failed to create resource');
    }
    const sortOrder = await insertAtTop({
      tx,
      collectionId,
      resourceId: row.id,
      addedByProfileUserId,
    });
    return { resourceId: row.id, sortOrder };
  });

  return loadResourceInCollectionDto({ resourceId, collectionId, sortOrder });
};

export type CreateDocumentInput = {
  authUserId: string;
  profileId?: string;
  collectionId?: string;
  title: string;
  description: string | null;
  storageObjectId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
};

export const createDocumentResource = async (
  input: CreateDocumentInput,
): Promise<ResourceInCollectionDto> => {
  const { collectionId, profileId } = await resolveTargetCollection({
    authUserId: input.authUserId,
    scope: {
      profileId: input.profileId,
      collectionId: input.collectionId,
    },
  });

  // Verify the storage object lives under this profile's resources/ prefix —
  // a guessed storageObjectId from another profile would otherwise link here.
  const [storageObject] = await db
    .select({ name: objectsInStorage.name })
    .from(objectsInStorage)
    .where(eq(objectsInStorage.id, input.storageObjectId))
    .limit(1);

  if (!storageObject) {
    throw new NotFoundError('Storage object', input.storageObjectId);
  }
  if (
    !storageObject.name ||
    !storageObject.name.startsWith(resourcePathPrefix(profileId))
  ) {
    throw new ValidationError('Storage object does not belong to this profile');
  }

  const addedByProfileUserId = await lookupProfileUserId({
    authUserId: input.authUserId,
    profileId,
  });

  const { resourceId, sortOrder } = await db.transaction(async (tx) => {
    const [attachment] = await tx
      .insert(attachments)
      .values({
        storageObjectId: input.storageObjectId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        profileId,
      })
      .returning();
    if (!attachment) {
      throw new ConflictError('Failed to create attachment');
    }

    const [row] = await tx
      .insert(resources)
      .values({
        title: input.title,
        description: input.description,
        attachmentId: attachment.id,
        addedByProfileUserId,
      })
      .returning();
    if (!row) {
      throw new ConflictError('Failed to create resource');
    }

    const sortOrder = await insertAtTop({
      tx,
      collectionId,
      resourceId: row.id,
      addedByProfileUserId,
    });
    return { resourceId: row.id, sortOrder };
  });

  return loadResourceInCollectionDto({ resourceId, collectionId, sortOrder });
};

export type UpdateResourceInput = {
  authUserId: string;
  id: string;
  patch: {
    title?: string;
    description?: string | null;
    linkUrl?: string;
  };
};

export const updateResource = async (
  input: UpdateResourceInput,
): Promise<ResourceDto> => {
  const profileId = await getCurrentProfileId(input.authUserId);
  await assertResourceAccess({
    profileId,
    authUserId: input.authUserId,
    level: 'write',
  });
  if (!(await profileOwnsResource({ profileId, resourceId: input.id }))) {
    throw new NotFoundError('Resource', input.id);
  }

  const existing = await db.query.resources.findFirst({
    where: { id: input.id },
  });
  if (!existing) {
    throw new NotFoundError('Resource', input.id);
  }

  const patchValues: Partial<Resource> = {};
  if (input.patch.title !== undefined) {
    patchValues.title = input.patch.title;
  }
  if (input.patch.description !== undefined) {
    patchValues.description = input.patch.description;
  }

  if (input.patch.linkUrl !== undefined) {
    if (resourceType(existing) !== 'link') {
      throw new ValidationError(
        'linkUrl can only be updated on link resources',
      );
    }
    patchValues.linkUrl = input.patch.linkUrl;
  }

  const [row] = await db
    .update(resources)
    .set(patchValues)
    .where(eq(resources.id, input.id))
    .returning();

  if (!row) {
    throw new NotFoundError('Resource', input.id);
  }
  return loadResourceDtoById(row.id);
};

export const reorderResource = async ({
  authUserId,
  resourceId,
  collectionId,
  upperNeighborId,
}: {
  authUserId: string;
  resourceId: string;
  collectionId: string;
  upperNeighborId: string | null;
}): Promise<ResourceInCollectionDto> => {
  const profileId = await getCurrentProfileId(authUserId);
  await assertResourceAccess({ profileId, authUserId, level: 'write' });
  const [ownsCollection, ownsResource] = await Promise.all([
    profileOwnsCollection({ profileId, collectionId }),
    profileOwnsResource({ profileId, resourceId }),
  ]);
  if (!ownsCollection) {
    throw new NotFoundError('Collection', collectionId);
  }
  if (!ownsResource) {
    throw new NotFoundError('Resource', resourceId);
  }

  const finalSortOrder = await db.transaction(async (tx) => {
    await lockCollection({ tx, collectionId });

    const plan = await computeReorder({
      tx,
      collectionId,
      itemId: resourceId,
      upperNeighborId,
    });
    if (plan) {
      await applySortOrderUpdates({
        tx,
        table: resourceCollectionItems,
        updates: plan.updates,
      });
    }

    const link = await findCollectionItem({ tx, collectionId, resourceId });
    if (!link) {
      throw new NotFoundError('Resource membership', resourceId);
    }
    return link.sortOrder;
  });

  return loadResourceInCollectionDto({
    resourceId,
    collectionId,
    sortOrder: finalSortOrder,
  });
};

export const attachResourceToCollection = async ({
  authUserId,
  resourceId,
  collectionId,
}: {
  authUserId: string;
  resourceId: string;
  collectionId: string;
}): Promise<ResourceInCollectionDto> => {
  const profileId = await getCurrentProfileId(authUserId);
  await assertResourceAccess({ profileId, authUserId, level: 'write' });
  const [ownsCollection, ownsResource] = await Promise.all([
    profileOwnsCollection({ profileId, collectionId }),
    profileOwnsResource({ profileId, resourceId }),
  ]);
  if (!ownsCollection) {
    throw new NotFoundError('Collection', collectionId);
  }
  if (!ownsResource) {
    throw new NotFoundError('Resource', resourceId);
  }

  const addedByProfileUserId = await lookupProfileUserId({
    authUserId,
    profileId,
  });

  const sortOrder = await db.transaction(async (tx) => {
    const existing = await findCollectionItem({ tx, collectionId, resourceId });
    if (existing) {
      return existing.sortOrder;
    }
    return insertAtTop({ tx, collectionId, resourceId, addedByProfileUserId });
  });

  return loadResourceInCollectionDto({ resourceId, collectionId, sortOrder });
};

export const detachResourceFromCollection = async ({
  authUserId,
  resourceId,
  collectionId,
}: {
  authUserId: string;
  resourceId: string;
  collectionId: string;
}): Promise<{ ok: true }> => {
  const profileId = await getCurrentProfileId(authUserId);
  await assertResourceAccess({ profileId, authUserId, level: 'write' });
  const [ownsCollection, ownsResource] = await Promise.all([
    profileOwnsCollection({ profileId, collectionId }),
    profileOwnsResource({ profileId, resourceId }),
  ]);
  if (!ownsCollection) {
    throw new NotFoundError('Collection', collectionId);
  }
  if (!ownsResource) {
    throw new NotFoundError('Resource', resourceId);
  }

  await db.transaction(async (tx) => {
    await lockCollection({ tx, collectionId });
    await tx
      .delete(resourceCollectionItems)
      .where(
        and(
          eq(resourceCollectionItems.collectionId, collectionId),
          eq(resourceCollectionItems.resourceId, resourceId),
        ),
      );

    // Compact sortOrder after deletion.
    const rows = await tx
      .select({
        id: resourceCollectionItems.id,
        sortOrder: resourceCollectionItems.sortOrder,
      })
      .from(resourceCollectionItems)
      .where(eq(resourceCollectionItems.collectionId, collectionId))
      .orderBy(asc(resourceCollectionItems.sortOrder));

    const updates: Array<{ id: string; sortOrder: number }> = [];
    rows.forEach((row, idx) => {
      if (row.sortOrder !== idx) {
        updates.push({ id: row.id, sortOrder: idx });
      }
    });
    await applySortOrderUpdates({
      tx,
      table: resourceCollectionItems,
      updates,
    });
  });

  return { ok: true };
};

export const deleteResource = async ({
  authUserId,
  id,
}: {
  authUserId: string;
  id: string;
}): Promise<{ ok: true }> => {
  const profileId = await getCurrentProfileId(authUserId);
  await assertResourceAccess({ profileId, authUserId, level: 'write' });
  if (!(await profileOwnsResource({ profileId, resourceId: id }))) {
    throw new NotFoundError('Resource', id);
  }

  const existing = await db.query.resources.findFirst({
    where: { id },
    with: {
      attachment: { with: { storageObject: true } },
    },
  });
  if (!existing) {
    throw new NotFoundError('Resource', id);
  }

  const storageObjectName = existing.attachment?.storageObject?.name ?? null;

  await db.transaction(async (tx) => {
    // Snapshot memberships before the cascade to know which collections need
    // sort_order compacted. Ordered lock acquisition avoids deadlocks.
    const memberships = await tx
      .select({ collectionId: resourceCollectionItems.collectionId })
      .from(resourceCollectionItems)
      .where(eq(resourceCollectionItems.resourceId, id))
      .orderBy(asc(resourceCollectionItems.collectionId));

    for (const membership of memberships) {
      await lockCollection({ tx, collectionId: membership.collectionId });
    }

    await tx.delete(resources).where(eq(resources.id, id));
    if (existing.attachmentId) {
      await tx
        .delete(attachments)
        .where(eq(attachments.id, existing.attachmentId));
    }

    for (const membership of memberships) {
      const rows = await tx
        .select({
          id: resourceCollectionItems.id,
          sortOrder: resourceCollectionItems.sortOrder,
        })
        .from(resourceCollectionItems)
        .where(
          eq(resourceCollectionItems.collectionId, membership.collectionId),
        )
        .orderBy(asc(resourceCollectionItems.sortOrder));
      const updates: Array<{ id: string; sortOrder: number }> = [];
      rows.forEach((row, idx) => {
        if (row.sortOrder !== idx) {
          updates.push({ id: row.id, sortOrder: idx });
        }
      });
      await applySortOrderUpdates({
        tx,
        table: resourceCollectionItems,
        updates,
      });
    }
  });

  if (storageObjectName) {
    await deleteResourceObject(storageObjectName);
  }

  return { ok: true };
};
