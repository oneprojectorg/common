'use client';

import { trpc } from '@op/api/client';
import type { ResourceInCollection, ResourceList } from '@op/api/encoders';
import { Sortable } from '@op/ui/Sortable';
import { toast } from '@op/ui/Toast';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { DeleteResourceModal } from './DeleteResourceModal';
import { ResourceCard } from './ResourceCard';
import { ResourceOverflowMenu } from './ResourceOverflowMenu';
import { findMovedItem, moveItemAfter } from './utils';

export const ResourcesList = ({
  data,
  canManage,
}: {
  data: ResourceList;
  canManage: boolean;
}) => {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const [deleteTarget, setDeleteTarget] = useState<ResourceInCollection | null>(
    null,
  );

  const reorder = trpc.resources.reorder.useMutation({
    onMutate: async (vars) => {
      const key = { collectionId: vars.collectionId };
      await utils.resources.listByCollection.cancel(key);
      const previous = utils.resources.listByCollection.getData(key);
      if (previous) {
        utils.resources.listByCollection.setData(key, {
          ...previous,
          items: moveItemAfter(previous.items, vars.id, vars.upperNeighborId),
        });
      }
      return { previous, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous && ctx?.key) {
        utils.resources.listByCollection.setData(ctx.key, ctx.previous);
      }
      toast.error({ message: t('Could not reorder resource') });
    },
  });

  const remove = trpc.resources.delete.useMutation({
    onSuccess: () => toast.success({ message: t('Resource deleted') }),
    onError: () => toast.error({ message: t('Could not delete resource') }),
  });

  const items = data.items;

  const handleReorder = (next: ResourceInCollection[]) => {
    const collectionId = data.collectionId;
    if (!collectionId) {
      return;
    }
    const moved = findMovedItem(items, next);
    if (!moved) {
      return;
    }
    const upperNeighborId = next[moved.newIndex - 1]?.id ?? null;
    reorder.mutate({ id: moved.id, collectionId, upperNeighborId });
  };

  if (items.length === 0) {
    return null;
  }

  const renderItem = (resource: ResourceInCollection) => (
    <ResourceCard
      resource={resource}
      signedUrl={resource.signedUrl}
      trailing={
        canManage ? (
          <ResourceOverflowMenu onDelete={() => setDeleteTarget(resource)} />
        ) : null
      }
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {canManage ? (
        <Sortable
          items={items}
          onChange={handleReorder}
          dragTrigger="item"
          getItemLabel={(resource) => resource.title}
          className="gap-4"
        >
          {(resource) => renderItem(resource)}
        </Sortable>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((resource) => (
            <div key={resource.id}>{renderItem(resource)}</div>
          ))}
        </div>
      )}
      <DeleteResourceModal
        isOpen={deleteTarget !== null}
        onConfirm={() => {
          if (deleteTarget) {
            remove.mutate({ id: deleteTarget.id });
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
