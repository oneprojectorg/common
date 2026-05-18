'use client';

import { trpc } from '@op/api/client';
import { toast } from '@op/ui/Toast';

import { useTranslations } from '@/lib/i18n';

import type { ResourceListPayload } from '../types';

const moveResource = (
  prev: ResourceListPayload,
  id: string,
  beforeId: string | undefined,
  afterId: string | undefined,
): ResourceListPayload => {
  const list = prev.resources;
  const fromIdx = list.findIndex((r) => r.id === id);
  if (fromIdx === -1) return prev;
  const moved = list[fromIdx];
  if (!moved) return prev;
  const without = list.filter((r) => r.id !== id);
  let toIdx: number;
  if (afterId !== undefined) {
    toIdx = without.findIndex((r) => r.id === afterId);
    if (toIdx === -1) return prev;
  } else if (beforeId !== undefined) {
    const beforeIdx = without.findIndex((r) => r.id === beforeId);
    if (beforeIdx === -1) return prev;
    toIdx = beforeIdx + 1;
  } else {
    return prev;
  }
  const reordered = [
    ...without.slice(0, toIdx),
    moved,
    ...without.slice(toIdx),
  ];
  return { ...prev, resources: reordered };
};

export const useResourceMutations = (profileId: string) => {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const listKey = { profileId };
  const invalidate = () => utils.resources.list.invalidate(listKey);

  const createLink = trpc.resources.createLink.useMutation({
    onSuccess: () => {
      toast.success({ message: t('Resource added') });
    },
    onError: (err) => {
      toast.error({ message: err.message || t('Could not add resource') });
    },
    onSettled: () => {
      void invalidate();
    },
  });

  const createDocument = trpc.resources.createDocument.useMutation({
    onSuccess: () => {
      toast.success({ message: t('Resource added') });
    },
    onError: (err) => {
      toast.error({ message: err.message || t('Could not add resource') });
    },
    onSettled: () => {
      void invalidate();
    },
  });

  const reorder = trpc.resources.reorder.useMutation({
    onMutate: async (vars) => {
      await utils.resources.list.cancel(listKey);
      const prev = utils.resources.list.getData(listKey);
      if (prev) {
        utils.resources.list.setData(
          listKey,
          moveResource(prev, vars.id, vars.beforeId, vars.afterId),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.resources.list.setData(listKey, ctx.prev);
      toast.error({ message: t('Could not reorder resource') });
    },
    onSettled: () => {
      void invalidate();
    },
  });

  const remove = trpc.resources.delete.useMutation({
    onSuccess: () => {
      toast.success({ message: t('Resource deleted') });
    },
    onError: () => {
      toast.error({ message: t('Could not delete resource') });
    },
    onSettled: () => {
      void invalidate();
    },
  });

  return { createLink, createDocument, reorder, remove };
};
