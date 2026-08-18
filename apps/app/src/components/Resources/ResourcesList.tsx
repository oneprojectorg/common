'use client';

import { trpc } from '@op/api/client';
import type { ResourceInCollection, ResourceList } from '@op/api/encoders';
import { Sortable } from '@op/sense/Sortable';
import { toast } from '@op/sense/Toast';
import { useMemo, useState } from 'react';
import { LuUpload } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { useDecisionTranslation } from '@/components/decisions/DecisionTranslationContext';
import { useRegisterTranslationSamples } from '@/components/decisions/TranslationDetectionContext';
import { getResourceDetectionSamples } from '@/components/decisions/translationDetectionText';

import { ResourceCard } from './ResourceCard';
import { ResourceDropZone } from './ResourceDropZone';
import { ResourceOverflowMenu } from './ResourceOverflowMenu';
import { findMovedItem, moveItemAfter } from './utils';

export const ResourcesList = ({
  profileId,
  data,
  canManage,
}: {
  profileId: string;
  data: ResourceList;
  canManage: boolean;
}) => {
  const t = useTranslations();
  const decisionTranslation = useDecisionTranslation();
  const utils = trpc.useUtils();
  const [deleteTarget, setDeleteTarget] = useState<ResourceInCollection | null>(
    null,
  );
  // Mirror the server order locally so the drop animation settles into the
  // new position in the same render batch that ends the drag. The mutation's
  // onMutate awaits cancel before patching the tRPC cache, so without this
  // mirror dnd-kit snaps the item back before the optimistic update lands.
  // Sync during render (not in an effect) by tracking the source reference.
  const [items, setItems] = useState<ResourceInCollection[]>(data.items);
  const [syncedFrom, setSyncedFrom] = useState(data.items);
  if (syncedFrom !== data.items) {
    setSyncedFrom(data.items);
    setItems(data.items);
  }

  // `handleTranslate` already sends this profile's resources to
  // translateResources. Register their text so the Translate control appears
  // for a reader whose only unreadable content is a resource. No-ops outside a
  // decision screen, where no detection provider is mounted.
  //
  // Keyed per collection because a decision with more than one renders a list
  // per collection, all mounted together in the open accordion. A shared key
  // would let the last one registered drop every other collection's samples,
  // hiding the control on a foreign-language resource in an earlier section.
  const resourceSamples = useMemo(
    () => getResourceDetectionSamples(items),
    [items],
  );
  useRegisterTranslationSamples(
    `resources:${data.collectionId ?? profileId}`,
    resourceSamples,
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
      toast.error(t('Could not reorder resource'));
    },
  });

  const remove = trpc.resources.delete.useMutation({
    onSuccess: () => toast.success(t('Resource deleted')),
    onError: () => toast.error(t('Could not delete resource')),
  });

  const collectionId = data.collectionId ?? null;

  const handleReorder = (next: ResourceInCollection[]) => {
    if (!collectionId) {
      return;
    }
    const moved = findMovedItem(items, next);
    if (!moved) {
      return;
    }
    setItems(next);
    const upperNeighborId = next[moved.newIndex - 1]?.id ?? null;
    reorder.mutate({ id: moved.id, collectionId, upperNeighborId });
  };

  if (items.length === 0 && !canManage) {
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

  if (!canManage) {
    return (
      <div className="flex flex-col gap-4">
        {items.map((resource) => (
          <div key={resource.id}>{renderItem(resource)}</div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ResourceDropZone
        profileId={profileId}
        collectionId={collectionId}
        items={items}
        renderItem={renderItem}
      >
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input px-6 py-10 text-center text-muted-foreground">
            <LuUpload className="size-6" />
            <p className="text-sm">{t('Drag a file or link here to add it')}</p>
          </div>
        ) : (
          <Sortable
            items={items}
            onChange={handleReorder}
            dragTrigger="item"
            getItemLabel={(resource) =>
              decisionTranslation?.resources[resource.id]?.title ??
              resource.title
            }
            className="gap-4"
          >
            {(resource) => renderItem(resource)}
          </Sortable>
        )}
      </ResourceDropZone>
      <ConfirmDeleteModal
        isOpen={deleteTarget !== null}
        title={t('Delete this resource?')}
        message={t('This action cannot be undone.')}
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
