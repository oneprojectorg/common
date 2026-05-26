'use client';

import { trpc } from '@op/api/client';
import { reorderByUpperNeighbor } from '@op/common/reorder';
import { toast } from '@op/ui/Toast';

import { useTranslations } from '@/lib/i18n';

import type { ResourceListPayload } from '../types';

const moveResource = (
  prev: ResourceListPayload,
  id: string,
  upperNeighborId: string | null,
): ResourceListPayload => {
  const reordered = reorderByUpperNeighbor(
    prev.resources,
    (r) => r.id,
    id,
    upperNeighborId,
  );
  if (reordered === prev.resources) return prev;
  return { ...prev, resources: [...reordered] };
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
      if (ctx?.prev) utils.resources.list.setData(listKey, ctx.prev);
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
