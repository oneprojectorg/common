'use client';

import { trpc } from '@op/api/client';
import { toast } from '@op/ui/Toast';

import { useTranslations } from '@/lib/i18n';

import type { ResourceListPayload } from '../types';

const moveResource = (
  prev: ResourceListPayload,
  id: string,
  upperNeighborId: string | null,
): ResourceListPayload => {
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

  const listKey = { profileId };

  const createLink = trpc.resources.createLink.useMutation({
    onSuccess: () => {
      toast.success({ message: t('Resource added') });
    },
    onError: (err) => {
      toast.error({ message: err.message || t('Could not add resource') });
    },
  });

  const createDocument = trpc.resources.createDocument.useMutation({
    onSuccess: () => {
      toast.success({ message: t('Resource added') });
    },
    onError: (err) => {
      toast.error({ message: err.message || t('Could not add resource') });
    },
  });

  const reorder = trpc.resources.reorder.useMutation({
    onMutate: async (vars) => {
      await utils.resources.list.cancel(listKey);
      const prev = utils.resources.list.getData(listKey);
      if (prev) {
        utils.resources.list.setData(
          listKey,
          moveResource(prev, vars.id, vars.upperNeighborId),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        utils.resources.list.setData(listKey, ctx.prev);
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
