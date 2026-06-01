import { type Resource, type ResourceType } from '@op/db/schema';

import { ConflictError } from '../../utils/error';
import { getResourceSignedUrl } from './storage';
import { type AttachmentSummary, type ResourceDTO } from './types';

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
