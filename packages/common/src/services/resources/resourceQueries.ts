import { db } from '@op/db/client';
import { type Resource, type ResourceType } from '@op/db/schema';

import { decodeCursor, encodeCursor } from '../../utils';
import { ConflictError, NotFoundError } from '../../utils/error';
import { getResourceSignedUrl } from './storage';
import {
  RESOURCE_LIST_DEFAULT_LIMIT,
  RESOURCE_LIST_MAX_LIMIT,
  type AttachmentSummary,
  type ResourceDTO,
  type ResourceInCollectionDTO,
  type ResourceListResult,
} from './types';

type SortKeyCursor = { value: string };

export type LoadedResource = Resource & {
  attachment: {
    storageObjectId: string;
    fileName: string;
    mimeType: string;
    fileSize: number | null;
    storageObject: { name: string | null } | null;
  } | null;
};

export const resourceType = (
  row: Pick<Resource, 'attachmentId'>,
): ResourceType => (row.attachmentId !== null ? 'document' : 'link');

// Bundles the attachment projection with its signed URL — the signed URL is
// the only async work in resource hydration, and it only exists when there's
// an attachment to point at.
export const getResourceAttachment = async (
  row: LoadedResource,
): Promise<{
  attachment: AttachmentSummary | null;
  signedUrl: string | null;
}> => {
  if (!row.attachment) {
    return { attachment: null, signedUrl: null };
  }
  const signedUrl = row.attachment.storageObject?.name
    ? await getResourceSignedUrl(row.attachment.storageObject.name)
    : null;
  return {
    attachment: {
      storageObjectId: row.attachment.storageObjectId,
      fileName: row.attachment.fileName,
      mimeType: row.attachment.mimeType,
      fileSize: row.attachment.fileSize,
    },
    signedUrl,
  };
};

export const getResource = async (
  row: LoadedResource,
): Promise<ResourceDTO> => {
  const { attachment, signedUrl } = await getResourceAttachment(row);

  const base = {
    id: row.id,
    title: row.title,
    description: row.description,
    addedByProfileId: row.addedByProfileId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    signedUrl,
  };

  if (resourceType(row) === 'document') {
    if (!attachment || row.attachmentId === null) {
      throw new ConflictError(
        'Resource has document type but missing attachment',
      );
    }
    return {
      ...base,
      type: 'document',
      linkUrl: null,
      attachmentId: row.attachmentId,
      attachment,
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

export const getResourceById = async (id: string): Promise<ResourceDTO> => {
  const row = await db.query.resources.findFirst({
    where: { id },
    with: { attachment: { with: { storageObject: true } } },
  });
  if (!row) {
    throw new NotFoundError('Resource', id);
  }
  return getResource(row);
};

export const getResourceInCollection = async ({
  resourceId,
  collectionId,
  sortKey,
}: {
  resourceId: string;
  collectionId: string;
  sortKey: string;
}): Promise<ResourceInCollectionDTO> => {
  const base = await getResourceById(resourceId);
  return { ...base, collectionId, sortKey };
};

export const getResourcesInCollection = async ({
  collectionId,
  limit = RESOURCE_LIST_DEFAULT_LIMIT,
  cursor,
}: {
  collectionId: string;
  limit?: number;
  cursor?: string | null;
}): Promise<ResourceListResult> => {
  const clampedLimit = Math.min(Math.max(1, limit), RESOURCE_LIST_MAX_LIMIT);
  const decoded = cursor ? decodeCursor<SortKeyCursor>(cursor) : undefined;

  // DB-level pagination: WHERE sort_key > cursor LIMIT N+1. The +1 lets us
  // detect whether a next page exists without a second round trip.
  const rows = await db.query.resourceCollectionItems.findMany({
    where: decoded
      ? { collectionId, sortKey: { gt: decoded.value } }
      : { collectionId },
    orderBy: { sortKey: 'asc' },
    limit: clampedLimit + 1,
    with: {
      resource: {
        with: { attachment: { with: { storageObject: true } } },
      },
    },
  });

  const pageItems = rows.slice(0, clampedLimit);
  const hasMore = rows.length > clampedLimit;

  const items = await Promise.all(
    pageItems.map(async (item) => {
      const base = await getResource(item.resource);
      return { ...base, collectionId, sortKey: item.sortKey };
    }),
  );

  const lastSortKey = pageItems[pageItems.length - 1]?.sortKey;
  const next =
    hasMore && lastSortKey
      ? encodeCursor<SortKeyCursor>({ value: lastSortKey })
      : null;
  return { collectionId, items, next };
};
