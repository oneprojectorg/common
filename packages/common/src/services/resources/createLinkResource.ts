import { db } from '@op/db/client';
import { resources } from '@op/db/schema';

import { ConflictError } from '../../utils/error';
import { getIndividualProfileId } from '../access';
import { getLinkPreview } from '../linkPreview/getLinkPreview';
import { RESOURCE_TITLE_MAX_LEN } from './constants';
import { getResourceById } from './getResourceById';
import { insertResourceAt } from './ordering';
import { resolveTargetCollection } from './resolveTargetCollection';
import { type ResourceInCollectionDTO } from './types';

export type CreateLinkInput = {
  authUserId: string;
  profileId?: string;
  collectionId?: string;
  title?: string;
  description: string | null;
  linkUrl: string;
  // When provided (including null), the new resource is inserted directly below
  // this collection member (null = top) instead of at the top. Drives drop-at-a
  // -specific-sort-point; the Add Resource form omits it and lands at the top.
  upperNeighborId?: string | null;
};

const resolveLinkTitle = async (
  linkUrl: string,
  userTitle?: string,
): Promise<string> => {
  if (userTitle?.trim()) {
    return userTitle.trim();
  }

  try {
    const preview = await getLinkPreview(linkUrl);
    if (preview.meta?.title?.trim()) {
      return preview.meta.title.trim().slice(0, RESOURCE_TITLE_MAX_LEN);
    }
  } catch {
    // Fall through to hostname fallback
  }

  // Fallback to hostname
  try {
    const hostname = new URL(linkUrl).hostname.replace(/^www\./i, '');
    if (hostname) {
      return hostname.slice(0, RESOURCE_TITLE_MAX_LEN);
    }
  } catch {
    // Fall through to URL fallback
  }

  // Final fallback to URL
  return linkUrl.slice(0, RESOURCE_TITLE_MAX_LEN);
};

export const createLinkResource = async (
  input: CreateLinkInput,
): Promise<ResourceInCollectionDTO> => {
  const [{ collectionId }, addedByProfileId, resolvedTitle] = await Promise.all(
    [
      resolveTargetCollection({
        authUserId: input.authUserId,
        scope: {
          profileId: input.profileId,
          collectionId: input.collectionId,
        },
      }),
      getIndividualProfileId(input.authUserId),
      resolveLinkTitle(input.linkUrl, input.title),
    ],
  );

  const { resourceId, sortKey } = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(resources)
      .values({
        title: resolvedTitle,
        description: input.description,
        linkUrl: input.linkUrl,
        addedByProfileId,
      })
      .returning();
    if (!row) {
      throw new ConflictError('Failed to create resource');
    }
    // `upperNeighborId: null` (the Add Resource form's default, since it omits
    // the field) inserts at the top, so a single insertResourceAt call covers
    // both the drop-at-a-slot and add-at-top cases.
    const resourceItem = await insertResourceAt({
      tx,
      collectionId,
      resourceId: row.id,
      upperNeighborId: input.upperNeighborId ?? null,
      addedByProfileId,
    });
    return { resourceId: row.id, sortKey: resourceItem.sortKey };
  });

  const base = await getResourceById({ id: resourceId });
  return { ...base, collectionId, sortKey };
};
