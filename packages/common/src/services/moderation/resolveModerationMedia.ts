import { db, eq } from '@op/db/client';
import {
  attachments,
  objectsInStorage,
  proposalAttachments,
} from '@op/db/schema';

import { getExternalResourceSignedUrl } from '../resources/storage';
import type {
  ModerationItemType,
  ModerationMediaItem,
  ModerationMediaKind,
} from './types';

/** Maps a MIME type to the broad kind providers route on. */
const mediaKindFromMime = (mimeType: string | null): ModerationMediaKind => {
  if (mimeType?.startsWith('image/')) {
    return 'image';
  }
  if (mimeType?.startsWith('video/')) {
    return 'video';
  }
  if (mimeType?.startsWith('audio/')) {
    return 'audio';
  }
  return 'other';
};

/**
 * Resolves an item's attachments to publicly-fetchable signed URLs (each
 * tagged with its media kind) so the moderation provider can review
 * images/video/audio alongside the text — and route each to the right field
 * rather than treating everything as an image. Posts link attachments
 * directly; proposals go through the join table. Users carry no media.
 * Unsignable objects are dropped.
 */
export const resolveModerationMedia = async (
  itemType: ModerationItemType,
  itemId: string,
): Promise<ModerationMediaItem[]> => {
  let rows: Array<{ name: string | null; mimeType: string | null }> = [];

  if (itemType === 'post') {
    rows = await db
      .select({ name: objectsInStorage.name, mimeType: attachments.mimeType })
      .from(attachments)
      .innerJoin(
        objectsInStorage,
        eq(objectsInStorage.id, attachments.storageObjectId),
      )
      .where(eq(attachments.postId, itemId));
  } else if (itemType === 'proposal') {
    rows = await db
      .select({ name: objectsInStorage.name, mimeType: attachments.mimeType })
      .from(proposalAttachments)
      .innerJoin(
        attachments,
        eq(attachments.id, proposalAttachments.attachmentId),
      )
      .innerJoin(
        objectsInStorage,
        eq(objectsInStorage.id, attachments.storageObjectId),
      )
      .where(eq(proposalAttachments.proposalId, itemId));
  }

  const signable = rows.filter(
    (row): row is { name: string; mimeType: string | null } =>
      Boolean(row.name),
  );
  const items = await Promise.all(
    signable.map(async (row) => {
      const url = await getExternalResourceSignedUrl(row.name);
      return url ? { url, kind: mediaKindFromMime(row.mimeType) } : null;
    }),
  );
  return items.filter((item): item is ModerationMediaItem => item !== null);
};
