'use client';

import { trpc } from '@op/api/client';
import {
  RESOURCE_TITLE_MAX_LEN,
  isAllowedUploadMimeType,
} from '@op/common/client';
import { toast } from '@op/sense/Sonner';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { hostnameForDisplay, stripExtension, truncateName } from '../utils';
import { useResourceUpload } from './useResourceUpload';

// A skeleton standing in for an in-flight (or about-to-drop) resource, rendered
// at `index` among the collection's real items.
export type PendingDrop = {
  tempId: string;
  index: number;
};

// Runs the same create flow as the Add Resource panel, but triggered by a drop
// and targeted at an explicit sort slot. Files upload then createDocument;
// links resolve a preview title then createLink. Multiple files are processed
// sequentially, each chained below the previous so they keep drop order. While
// a create is in flight, a PendingDrop placeholder holds its slot; the realtime
// `collectionResources` channel refetches the list and the real card replaces
// the placeholder once the placeholder is cleared on settle.
//
// `collectionId` is null when dropping into an empty panel that has no
// collection yet — the create then targets the profile, which lazily creates
// the Default collection, and the resource lands at the top (no sort slot to
// honor yet, so upperNeighborId is ignored by callers).
export const useResourceDrop = ({
  profileId,
  collectionId,
}: {
  profileId: string;
  collectionId: string | null;
}) => {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const { upload } = useResourceUpload(profileId);
  const onError = () => {
    // Match the rest of the resource UI: a generic message, never raw
    // server error text.
    toast.error(t('Could not add resource'));
  };
  const createDocument = trpc.resources.createDocument.useMutation({ onError });
  const createLink = trpc.resources.createLink.useMutation({ onError });
  const [pending, setPending] = useState<PendingDrop[]>([]);

  const addPending = (index: number): string => {
    const tempId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    setPending((prev) => [...prev, { tempId, index }]);
    return tempId;
  };

  const removePending = (tempId: string) => {
    setPending((prev) => prev.filter((item) => item.tempId !== tempId));
  };

  const dropFiles = async (
    files: File[],
    upperNeighborId: string | null,
    startIndex: number,
  ) => {
    // Chain each file below the previous so a multi-file drop preserves order.
    // When dropping into an empty panel (collectionId null) the first file
    // lazily creates the Default collection; capture its id from the response
    // so the rest of the batch targets that collection and chains, instead of
    // each landing at the top (which would reverse the drop order).
    let targetCollectionId = collectionId;
    let neighbor = upperNeighborId;
    let index = startIndex;
    for (const file of files) {
      const tempId = addPending(index);
      try {
        const uploaded = await upload(file);
        if (!uploaded) {
          // upload() already surfaced the error toast (type/size/network).
          continue;
        }
        if (!isAllowedUploadMimeType(uploaded.mimeType)) {
          // upload() no longer narrows the mime type; the backend enforces the
          // allowlist, but guard here so the create input stays well-typed and
          // we fail fast with a clear message instead of a server rejection.
          toast.error(t('Unsupported file type'));
          continue;
        }
        const row = await createDocument.mutateAsync({
          // Files always use a profile target — not a collection target — so
          // createDocument validates the storage path against the profile the
          // upload was namespaced under (matches the Add Resource form's M:N
          // handling). collectionId scopes it to the dropped-on collection
          // when there is one; omitting it lazily creates the Default.
          target: {
            kind: 'profile',
            profileId: uploaded.profileId,
            collectionId: targetCollectionId ?? undefined,
          },
          storagePath: uploaded.storagePath,
          fileName: uploaded.fileName,
          mimeType: uploaded.mimeType,
          title: truncateName(stripExtension(uploaded.fileName)),
          description: null,
          upperNeighborId: targetCollectionId ? neighbor : undefined,
        });
        targetCollectionId = targetCollectionId ?? row.collectionId;
        neighbor = row.id;
        index += 1;
      } catch {
        // createDocument.onError already toasts; keep going for the rest.
      } finally {
        removePending(tempId);
      }
    }
  };

  const dropLink = async (
    linkUrl: string,
    upperNeighborId: string | null,
    index: number,
  ) => {
    const tempId = addPending(index);
    try {
      // Same title derivation as the URL input: prefer the preview title, fall
      // back to the hostname.
      const preview = await utils.content.linkPreview
        .fetch({ url: linkUrl })
        .catch(() => null);
      const title =
        preview?.meta?.title?.slice(0, RESOURCE_TITLE_MAX_LEN) ||
        hostnameForDisplay(linkUrl, RESOURCE_TITLE_MAX_LEN) ||
        linkUrl.slice(0, RESOURCE_TITLE_MAX_LEN);
      await createLink.mutateAsync({
        // A collection target when dropping into an existing collection;
        // otherwise a profile target that lazily creates the Default.
        target: collectionId
          ? { kind: 'collection', collectionId }
          : { kind: 'profile', profileId },
        linkUrl,
        title,
        description: null,
        upperNeighborId: collectionId ? upperNeighborId : undefined,
      });
    } catch {
      // createLink.onError already toasts.
    } finally {
      removePending(tempId);
    }
  };

  return { pending, dropFiles, dropLink };
};
