import { db } from '@op/db/client';
import {
  attachments,
  objectsInStorage,
  profileUsers,
  resourceCollectionItems,
  resources,
  type Resource,
  type ResourceType,
} from '@op/db/schema';
import { and, asc, count, eq } from 'drizzle-orm';

import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../utils/error';
import { assertResourceAccess } from './access';
import { resolveOrCreatePinnedCollection } from './collections';
import {
  applySortOrderUpdates,
  computeReorder,
  findCollectionItem,
  lockCollection,
  shiftSortOrderForInsertAtTop,
} from './ordering';
import {
  deleteResourceObject,
  getResourceSignedUrl,
  resourcePathPrefix,
} from './storage';

export type AttachmentSummary = {
  storageObjectId: string;
  fileName: string;
  mimeType: string;
  fileSize: number | null;
};

export type ResourceDTO = Resource & {
  type: ResourceType;
  attachment: AttachmentSummary | null;
  signedUrl: string | null;
};

export type ResourceInCollectionDTO = ResourceDTO & {
  collectionId: string;
  sortOrder: number;
};

export type ResourceListResult = {
  collectionId: string | null;
  resources: ResourceInCollectionDTO[];
};

type LoadedResource = Resource & {
  attachment:
    | (AttachmentSummary & {
        storageObject: { name: string | null } | null;
      })
    | null;
};

const resourceType = (row: Pick<Resource, 'attachmentId'>): ResourceType =>
  row.attachmentId !== null ? 'document' : 'link';

const toResourceDTO = async (row: LoadedResource): Promise<ResourceDTO> => {
  const attachment = row.attachment
    ? {
        storageObjectId: row.attachment.storageObjectId,
        fileName: row.attachment.fileName,
        mimeType: row.attachment.mimeType,
        fileSize: row.attachment.fileSize,
      }
    : null;

  const storageObjectName = row.attachment?.storageObject?.name ?? null;
  const signedUrl = storageObjectName
    ? await getResourceSignedUrl(storageObjectName)
    : null;

  const { attachment: _omitted, ...rest } = row;
  return { ...rest, type: resourceType(row), attachment, signedUrl };
};

const loadResourceDTOById = async (id: string): Promise<ResourceDTO> => {
  const row = await db.query.resources.findFirst({
    where: { id },
    with: { attachment: { with: { storageObject: true } } },
  });
  if (!row) {
    throw new NotFoundError('Resource', id);
  }
  return toResourceDTO(row as LoadedResource);
};

const loadResourceInCollectionDTO = async (
  resourceId: string,
  collectionId: string,
  sortOrder: number,
): Promise<ResourceInCollectionDTO> => {
  const base = await loadResourceDTOById(resourceId);
  return { ...base, collectionId, sortOrder };
};

const fetchByCollection = async (
  collectionId: string,
): Promise<ResourceListResult> => {
  const rows = await db
    .select({
      sortOrder: resourceCollectionItems.sortOrder,
      resource: resources,
    })
    .from(resourceCollectionItems)
    .innerJoin(resources, eq(resources.id, resourceCollectionItems.resourceId))
    .where(eq(resourceCollectionItems.collectionId, collectionId))
    .orderBy(asc(resourceCollectionItems.sortOrder));

  const ids = rows.map((r) => r.resource.id);
  const hydrated = ids.length
    ? await db.query.resources.findMany({
        where: { id: { in: ids } },
        with: { attachment: { with: { storageObject: true } } },
      })
    : [];
  const byId = new Map(hydrated.map((row) => [row.id, row]));

  const dtos: ResourceInCollectionDTO[] = [];
  for (const r of rows) {
    const loaded = byId.get(r.resource.id);
    if (!loaded) continue;
    const base = await toResourceDTO(loaded as LoadedResource);
    dtos.push({ ...base, collectionId, sortOrder: r.sortOrder });
  }
  return { collectionId, resources: dtos };
};

export const listResources = async (
  authUserId: string,
  profileId: string,
): Promise<ResourceListResult> => {
  // Try write first so admin callers create the Pinned collection lazily; fall back to read.
  let canWrite = true;
  try {
    await assertResourceAccess(
      { kind: 'profile', profileId },
      authUserId,
      'write',
    );
  } catch {
    canWrite = false;
    await assertResourceAccess(
      { kind: 'profile', profileId },
      authUserId,
      'read',
    );
  }

  const collection = await resolveOrCreatePinnedCollection(profileId, canWrite);
  if (!collection) {
    return { collectionId: null, resources: [] };
  }

  return fetchByCollection(collection.id);
};

export const listResourcesByCollection = async (
  authUserId: string,
  collectionId: string,
): Promise<ResourceListResult> => {
  await assertResourceAccess(
    { kind: 'collection', collectionId },
    authUserId,
    'read',
  );
  return fetchByCollection(collectionId);
};

export const getResource = async (
  authUserId: string,
  id: string,
): Promise<ResourceDTO> => {
  await assertResourceAccess(
    { kind: 'resource', resourceId: id },
    authUserId,
    'read',
  );

  return loadResourceDTOById(id);
};

const resolveTargetCollection = async (
  authUserId: string,
  scope: { profileId?: string; collectionId?: string },
): Promise<{ collectionId: string; profileId: string }> => {
  if ((scope.profileId === undefined) === (scope.collectionId === undefined)) {
    throw new ValidationError(
      'Exactly one of profileId / collectionId is required',
    );
  }

  if (scope.collectionId) {
    const resolved = await assertResourceAccess(
      { kind: 'collection', collectionId: scope.collectionId },
      authUserId,
      'write',
    );
    return { collectionId: scope.collectionId, profileId: resolved.profileId };
  }

  const profileId = scope.profileId as string;
  await assertResourceAccess(
    { kind: 'profile', profileId },
    authUserId,
    'write',
  );
  const collection = await resolveOrCreatePinnedCollection(profileId, true);
  if (!collection) {
    throw new ConflictError('Failed to resolve collection');
  }
  return { collectionId: collection.id, profileId };
};

const lookupProfileUserId = async (
  authUserId: string,
  profileId: string,
): Promise<string | null> => {
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

const insertAtTop = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  collectionId: string,
  resourceId: string,
  addedByProfileUserId: string | null,
): Promise<number> => {
  await lockCollection(tx, collectionId);
  await shiftSortOrderForInsertAtTop(tx, collectionId);
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
): Promise<ResourceInCollectionDTO> => {
  const { collectionId, profileId } = await resolveTargetCollection(
    input.authUserId,
    {
      profileId: input.profileId,
      collectionId: input.collectionId,
    },
  );

  const addedByProfileUserId = await lookupProfileUserId(
    input.authUserId,
    profileId,
  );

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
    const sortOrder = await insertAtTop(
      tx,
      collectionId,
      row.id,
      addedByProfileUserId,
    );
    return { resourceId: row.id, sortOrder };
  });

  return loadResourceInCollectionDTO(resourceId, collectionId, sortOrder);
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
  const { collectionId, profileId } = await resolveTargetCollection(
    input.authUserId,
    {
      profileId: input.profileId,
      collectionId: input.collectionId,
    },
  );

  // Verify the client-supplied storage object actually lives under this
  // profile's resources/ prefix before linking it. Without this an attacker
  // who learned (or guessed) another profile's storageObjectId could create
  // an attachment row referencing it.
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

  const addedByProfileUserId = await lookupProfileUserId(
    input.authUserId,
    profileId,
  );

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

    const sortOrder = await insertAtTop(
      tx,
      collectionId,
      row.id,
      addedByProfileUserId,
    );
    return { resourceId: row.id, sortOrder };
  });

  return loadResourceInCollectionDTO(resourceId, collectionId, sortOrder);
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
  await assertResourceAccess(
    { kind: 'resource', resourceId: input.id },
    input.authUserId,
    'write',
  );

  const existing = await db.query.resources.findFirst({
    where: { id: input.id },
  });
  if (!existing) {
    throw new NotFoundError('Resource', input.id);
  }

  const patchValues: Partial<Resource> = {};
  if (input.patch.title !== undefined) patchValues.title = input.patch.title;
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

export const reorderResource = async (
  authUserId: string,
  resourceId: string,
  collectionId: string,
  beforeId: string | undefined,
  afterId: string | undefined,
): Promise<ResourceInCollectionDTO> => {
  await Promise.all([
    assertResourceAccess({ kind: 'resource', resourceId }, authUserId, 'write'),
    assertResourceAccess(
      { kind: 'collection', collectionId },
      authUserId,
      'write',
    ),
  ]);

  const finalSortOrder = await db.transaction(async (tx) => {
    await lockCollection(tx, collectionId);

    const plan = await computeReorder(
      tx,
      collectionId,
      resourceId,
      beforeId,
      afterId,
    );
    if (plan) {
      await applySortOrderUpdates(tx, plan.updates);
    }

    const link = await findCollectionItem(tx, collectionId, resourceId);
    if (!link) {
      throw new NotFoundError('Resource membership', resourceId);
    }
    return link.sortOrder;
  });

  return loadResourceInCollectionDTO(resourceId, collectionId, finalSortOrder);
};

export const attachResourceToCollection = async (
  authUserId: string,
  resourceId: string,
  collectionId: string,
): Promise<ResourceInCollectionDTO> => {
  const [resolved] = await Promise.all([
    assertResourceAccess(
      { kind: 'collection', collectionId },
      authUserId,
      'write',
    ),
    assertResourceAccess({ kind: 'resource', resourceId }, authUserId, 'write'),
  ]);

  const addedByProfileUserId = await lookupProfileUserId(
    authUserId,
    resolved.profileId,
  );

  const sortOrder = await db.transaction(async (tx) => {
    const existing = await findCollectionItem(tx, collectionId, resourceId);
    if (existing) {
      return existing.sortOrder;
    }
    return insertAtTop(tx, collectionId, resourceId, addedByProfileUserId);
  });

  return loadResourceInCollectionDTO(resourceId, collectionId, sortOrder);
};

export const detachResourceFromCollection = async (
  authUserId: string,
  resourceId: string,
  collectionId: string,
): Promise<{ ok: true }> => {
  await Promise.all([
    assertResourceAccess({ kind: 'resource', resourceId }, authUserId, 'write'),
    assertResourceAccess(
      { kind: 'collection', collectionId },
      authUserId,
      'write',
    ),
  ]);

  await db.transaction(async (tx) => {
    await lockCollection(tx, collectionId);
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
    await applySortOrderUpdates(tx, updates);
  });

  return { ok: true };
};

export const deleteResource = async (
  authUserId: string,
  id: string,
): Promise<{ ok: true }> => {
  await assertResourceAccess(
    { kind: 'resource', resourceId: id },
    authUserId,
    'write',
  );

  const existing = await db.query.resources.findFirst({
    where: { id },
    with: {
      attachment: { with: { storageObject: true } },
    },
  });
  if (!existing) {
    throw new NotFoundError('Resource', id);
  }

  const loaded = existing as LoadedResource;
  const storageObjectName = loaded.attachment?.storageObject?.name ?? null;

  // Collect collections this resource belonged to so we can compact their
  // sortOrders after the cascading delete.
  const memberships = await db
    .select({ collectionId: resourceCollectionItems.collectionId })
    .from(resourceCollectionItems)
    .where(eq(resourceCollectionItems.resourceId, id));

  await db.transaction(async (tx) => {
    await tx.delete(resources).where(eq(resources.id, id));
    if (loaded.attachmentId) {
      await tx
        .delete(attachments)
        .where(eq(attachments.id, loaded.attachmentId));
    }
  });

  // Best-effort resequence of affected collections.
  for (const membership of memberships) {
    await db.transaction(async (tx) => {
      await lockCollection(tx, membership.collectionId);
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
      await applySortOrderUpdates(tx, updates);
    });
  }

  if (storageObjectName) {
    await deleteResourceObject(storageObjectName);
  }

  // Silence unused count if no memberships.
  void count;
  return { ok: true };
};
