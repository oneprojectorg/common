'use client';

import { trpc } from '@op/api/client';
import type { ResourceList } from '@op/api/encoders';
import { toast } from '@op/ui/Toast';

import { useTranslations } from '@/lib/i18n';

const moveResource = (
  prev: ResourceList,
  id: string,
  upperNeighborId: string | null,
): ResourceList => {
  if (id === upperNeighborId) {
    return prev;
  }
  const fromIndex = prev.items.findIndex((r) => r.id === id);
  if (fromIndex === -1) {
    return prev;
  }
  const moved = prev.items[fromIndex]!;
  const without = prev.items.filter((_, i) => i !== fromIndex);
  let toIndex: number;
  if (upperNeighborId === null) {
    toIndex = 0;
  } else {
    const upperIndex = without.findIndex((r) => r.id === upperNeighborId);
    if (upperIndex === -1) {
      return prev;
    }
    toIndex = upperIndex + 1;
  }
  if (toIndex === fromIndex) {
    return prev;
  }
  return {
    ...prev,
    items: [...without.slice(0, toIndex), moved, ...without.slice(toIndex)],
  };
};

export const useResourceMutations = (profileId: string) => {
  const t = useTranslations();
  const utils = trpc.useUtils();

  // Resource create flows can lazy-create the default collection on the
  // server. The collections list query doesn't share an invalidation channel
  // with resource creates, so refetch it manually after a successful add.
  const invalidateCollectionsList = () => {
    void utils.resources.collections.list.invalidate({ profileId });
  };

  const createLink = trpc.resources.createLink.useMutation({
    onSuccess: () => {
      invalidateCollectionsList();
      toast.success({ message: t('Resource added') });
    },
    onError: (err) => {
      toast.error({ message: err.message || t('Could not add resource') });
    },
  });

  const createDocument = trpc.resources.createDocument.useMutation({
    onSuccess: () => {
      invalidateCollectionsList();
      toast.success({ message: t('Resource added') });
    },
    onError: (err) => {
      toast.error({ message: err.message || t('Could not add resource') });
    },
  });

  const reorder = trpc.resources.reorder.useMutation({
    onMutate: async (vars) => {
      const key = { collectionId: vars.collectionId };
      await utils.resources.listByCollection.cancel(key);
      const prev = utils.resources.listByCollection.getData(key);
      if (prev) {
        utils.resources.listByCollection.setData(
          key,
          moveResource(prev, vars.id, vars.upperNeighborId),
        );
      }
      return { prev, key };
    },
    onSuccess: (row, vars) => {
      // Patch the moved row's sortKey to the value the server returned so the
      // cached state matches DB truth. Order was already adjusted optimistically.
      const key = { collectionId: vars.collectionId };
      const cached = utils.resources.listByCollection.getData(key);
      if (!cached) {
        return;
      }
      utils.resources.listByCollection.setData(key, {
        ...cached,
        items: cached.items.map((item) =>
          item.id === row.id ? { ...item, sortKey: row.sortKey } : item,
        ),
      });
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev && ctx?.key) {
        utils.resources.listByCollection.setData(ctx.key, ctx.prev);
      }
      toast.error({ message: t('Could not reorder resource') });
    },
  });

  const remove = trpc.resources.delete.useMutation({
    onSuccess: () => {
      toast.success({ message: t('Resource deleted') });
    },
    onError: () => {
      toast.error({ message: t('Could not delete resource') });
    },
  });

  return { createLink, createDocument, reorder, remove };
};
