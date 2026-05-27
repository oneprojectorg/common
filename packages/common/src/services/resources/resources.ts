import { db, type TransactionType } from '@op/db/client';
import {
  EntityType,
  attachments,
  objectsInStorage,
  profileUsers,
  resourceCollectionItems,
  resourceCollectionProfiles,
  resources,
  type Resource,
  type ResourceType,
} from '@op/db/schema';
import { permission } from 'access-zones';
import { and, eq } from 'drizzle-orm';

import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils/error';
import { assertProfileTypeAccess, getCurrentProfileId } from '../access';
import { resolveOrCreateDefaultCollection } from './collections';
import { resourcePathPrefix } from './constants';
import {
  computeReorder,
  findCollectionItem,
  generateKeyForInsertAtTop,
  lockCollection,
} from './ordering';
import {
  type ResourceDTO,
  type ResourceInCollectionDTO,
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

const resourceType = (row: Pick<Resource, 'attachmentId'>): ResourceType =>
  row.attachmentId !== null ? 'document' : 'link';

const toResourceDTO = async (row: LoadedResource): Promise<ResourceDTO> => {
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

const loadResourceDTOById = async (id: string): Promise<ResourceDTO> => {
  const row = await db.query.resources.findFirst({
    where: { id },
    with: { attachment: { with: { storageObject: true } } },
  });
  if (!row) {
    throw new NotFoundError('Resource', id);
  }
  return toResourceDTO(row);
};

const loadResourceInCollectionDTO = async ({
  resourceId,
  collectionId,
  sortKey,
}: {
  resourceId: string;
  collectionId: string;
  sortKey: string;
}): Promise<ResourceInCollectionDTO> => {
  const base = await loadResourceDTOById(resourceId);
  return { ...base, collectionId, sortKey };
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
    orderBy: { sortKey: 'asc' },
    with: {
      resource: {
        with: { attachment: { with: { storageObject: true } } },
      },
    },
  });

  const dtos = await Promise.all(
    items.map(async (item) => {
      const base = await toResourceDTO(item.resource);
      return { ...base, collectionId, sortKey: item.sortKey };
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
  // Try write first so admin callers create the Default collection lazily; fall back to read.
  let canWrite = true;
  try {
    await assertProfileTypeAccess({
      user: { id: authUserId },
      profileIds: [profileId],
      policies: {
        [EntityType.DECISION]: { decisions: permission.ADMIN },
      },
    });
  } catch {
    canWrite = false;
    await assertProfileTypeAccess({
      user: { id: authUserId },
      profileIds: [profileId],
      policies: {
        [EntityType.DECISION]: { decisions: permission.READ },
      },
    });
  }

  const collection = await resolveOrCreateDefaultCollection({
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
  await assertProfileTypeAccess({
    user: { id: authUserId },
    profileIds: [profileId],
    policies: {
      [EntityType.DECISION]: { decisions: permission.READ },
    },
  });
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

  if (scope.collectionId !== undefined) {
    const [, ownsCollection] = await Promise.all([
      assertProfileTypeAccess({
        user: { id: authUserId },
        profileIds: [profileId],
        policies: {
          [EntityType.DECISION]: { decisions: permission.ADMIN },
        },
      }),
      profileOwnsCollection({
        profileId,
        collectionId: scope.collectionId,
      }),
    ]);
    if (!ownsCollection) {
      throw new NotFoundError('Collection', scope.collectionId);
    }
    return { collectionId: scope.collectionId, profileId };
  }

  await assertProfileTypeAccess({
    user: { id: authUserId },
    profileIds: [profileId],
    policies: {
      [EntityType.DECISION]: { decisions: permission.ADMIN },
    },
  });

  const collection = await resolveOrCreateDefaultCollection({
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
  tx: TransactionType;
  collectionId: string;
  resourceId: string;
  addedByProfileUserId: string | null;
}): Promise<string> => {
  await lockCollection({ tx, collectionId });
  const sortKey = await generateKeyForInsertAtTop({ tx, collectionId });
  const [link] = await tx
    .insert(resourceCollectionItems)
    .values({
      collectionId,
      resourceId,
      sortKey,
      addedByProfileUserId,
    })
    .returning();
  if (!link) {
    throw new ConflictError('Failed to attach resource to collection');
  }
  return sortKey;
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
): Promise<ResourceInCollectionDTO> => {
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

  const { resourceId, sortKey } = await db.transaction(async (tx) => {
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
    const sortKey = await insertAtTop({
      tx,
      collectionId,
      resourceId: row.id,
      addedByProfileUserId,
    });
    return { resourceId: row.id, sortKey };
  });

  return loadResourceInCollectionDTO({ resourceId, collectionId, sortKey });
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
): Promise<ResourceInCollectionDTO> => {
  const { collectionId, profileId } = await resolveTargetCollection({
    authUserId: input.authUserId,
    scope: {
      profileId: input.profileId,
      collectionId: input.collectionId,
    },
  });

  // Verify the storage object lives under this profile's resources/ prefix —
  // a guessed storageObjectId from another profile would otherwise link here.
  const [storageObjectRows, addedByProfileUserId] = await Promise.all([
    db
      .select({ name: objectsInStorage.name })
      .from(objectsInStorage)
      .where(eq(objectsInStorage.id, input.storageObjectId))
      .limit(1),
    lookupProfileUserId({ authUserId: input.authUserId, profileId }),
  ]);
  const storageObject = storageObjectRows[0];

  if (!storageObject) {
    throw new NotFoundError('Storage object', input.storageObjectId);
  }
  if (
    !storageObject.name ||
    !storageObject.name.startsWith(resourcePathPrefix(profileId))
  ) {
    throw new ValidationError('Storage object does not belong to this profile');
  }

  const { resourceId, sortKey } = await db.transaction(async (tx) => {
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

    const sortKey = await insertAtTop({
      tx,
      collectionId,
      resourceId: row.id,
      addedByProfileUserId,
    });
    return { resourceId: row.id, sortKey };
  });

  return loadResourceInCollectionDTO({ resourceId, collectionId, sortKey });
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
): Promise<ResourceDTO> => {
  const profileId = await getCurrentProfileId(input.authUserId);
  await assertProfileTypeAccess({
    user: { id: input.authUserId },
    profileIds: [profileId],
    policies: {
      [EntityType.DECISION]: { decisions: permission.ADMIN },
    },
  });
  const [ownsResource, existing] = await Promise.all([
    profileOwnsResource({ profileId, resourceId: input.id }),
    db.query.resources.findFirst({ where: { id: input.id } }),
  ]);
  if (!ownsResource) {
    throw new NotFoundError('Resource', input.id);
  }
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
  return loadResourceDTOById(row.id);
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
}): Promise<ResourceInCollectionDTO> => {
  const profileId = await getCurrentProfileId(authUserId);
  await assertProfileTypeAccess({
    user: { id: authUserId },
    profileIds: [profileId],
    policies: {
      [EntityType.DECISION]: { decisions: permission.ADMIN },
    },
  });
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

  const finalSortKey = await db.transaction(async (tx) => {
    await lockCollection({ tx, collectionId });

    const plan = await computeReorder({
      tx,
      collectionId,
      itemId: resourceId,
      upperNeighborId,
    });
    if (plan.changed) {
      await tx
        .update(resourceCollectionItems)
        .set({ sortKey: plan.sortKey })
        .where(eq(resourceCollectionItems.id, plan.rowId));
    }
    return plan.sortKey;
  });

  return loadResourceInCollectionDTO({
    resourceId,
    collectionId,
    sortKey: finalSortKey,
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
}): Promise<ResourceInCollectionDTO> => {
  const profileId = await getCurrentProfileId(authUserId);
  await assertProfileTypeAccess({
    user: { id: authUserId },
    profileIds: [profileId],
    policies: {
      [EntityType.DECISION]: { decisions: permission.ADMIN },
    },
  });
  const [ownsCollection, ownsResource, addedByProfileUserId] =
    await Promise.all([
      profileOwnsCollection({ profileId, collectionId }),
      profileOwnsResource({ profileId, resourceId }),
      lookupProfileUserId({ authUserId, profileId }),
    ]);
  if (!ownsCollection) {
    throw new NotFoundError('Collection', collectionId);
  }
  if (!ownsResource) {
    throw new NotFoundError('Resource', resourceId);
  }

  const sortKey = await db.transaction(async (tx) => {
    // Lock before the existence probe — otherwise two concurrent attaches both
    // see "no row", both call insertAtTop, and the second trips the
    // (collection_id, resource_id) unique index as a 500.
    await lockCollection({ tx, collectionId });
    const existing = await findCollectionItem({ tx, collectionId, resourceId });
    if (existing) {
      return existing.sortKey;
    }
    return insertAtTop({ tx, collectionId, resourceId, addedByProfileUserId });
  });

  return loadResourceInCollectionDTO({ resourceId, collectionId, sortKey });
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
  await assertProfileTypeAccess({
    user: { id: authUserId },
    profileIds: [profileId],
    policies: {
      [EntityType.DECISION]: { decisions: permission.ADMIN },
    },
  });
  const [ownsCollection, ownsResource, existing] = await Promise.all([
    profileOwnsCollection({ profileId, collectionId }),
    profileOwnsResource({ profileId, resourceId }),
    db.query.resources.findFirst({
      where: { id: resourceId },
      with: { attachment: { with: { storageObject: true } } },
    }),
  ]);
  if (!ownsCollection) {
    throw new NotFoundError('Collection', collectionId);
  }
  if (!ownsResource) {
    throw new NotFoundError('Resource', resourceId);
  }
  if (!existing) {
    throw new NotFoundError('Resource', resourceId);
  }

  const orphanedStorageObjectName = await db.transaction(async (tx) => {
    await lockCollection({ tx, collectionId });
    await tx
      .delete(resourceCollectionItems)
      .where(
        and(
          eq(resourceCollectionItems.collectionId, collectionId),
          eq(resourceCollectionItems.resourceId, resourceId),
        ),
      );

    // If this was the last membership, the resource has no home — cascade so
    // we don't leave a row that's unreachable via profileOwnsResource.
    const [remaining] = await tx
      .select({ id: resourceCollectionItems.id })
      .from(resourceCollectionItems)
      .where(eq(resourceCollectionItems.resourceId, resourceId))
      .limit(1);

    let storageObjectName: string | null = null;
    if (!remaining) {
      await tx.delete(resources).where(eq(resources.id, resourceId));
      if (existing.attachmentId) {
        await tx
          .delete(attachments)
          .where(eq(attachments.id, existing.attachmentId));
      }
      storageObjectName = existing.attachment?.storageObject?.name ?? null;
    }

    return storageObjectName;
  });

  if (orphanedStorageObjectName) {
    await deleteResourceObject(orphanedStorageObjectName);
  }

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
  await assertProfileTypeAccess({
    user: { id: authUserId },
    profileIds: [profileId],
    policies: {
      [EntityType.DECISION]: { decisions: permission.ADMIN },
    },
  });
  const [ownsResource, existing] = await Promise.all([
    profileOwnsResource({ profileId, resourceId: id }),
    db.query.resources.findFirst({
      where: { id },
      with: { attachment: { with: { storageObject: true } } },
    }),
  ]);
  if (!ownsResource) {
    throw new NotFoundError('Resource', id);
  }
  if (!existing) {
    throw new NotFoundError('Resource', id);
  }

  const storageObjectName = existing.attachment?.storageObject?.name ?? null;

  await db.transaction(async (tx) => {
    // resource_collection_items cascades on resource deletion; the resource
    // row goes first so we don't need to touch memberships explicitly.
    await tx.delete(resources).where(eq(resources.id, id));
    if (existing.attachmentId) {
      await tx
        .delete(attachments)
        .where(eq(attachments.id, existing.attachmentId));
    }
  });

  if (storageObjectName) {
    await deleteResourceObject(storageObjectName);
  }

  return { ok: true };
};
