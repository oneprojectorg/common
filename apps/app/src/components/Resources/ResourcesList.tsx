'use client';
import { useTRPC } from '@op/api/client';
import type { ResourceInCollection, ResourceList } from '@op/api/encoders';
import { Sortable } from '@op/sense/Sortable';
import { toast } from '@op/sense/Toast';
import { useMutation } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { LuUpload } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { useDecisionTranslation } from '@/components/decisions/DecisionTranslationContext';
import { useRegisterTranslationSamples } from '@/components/decisions/TranslationDetectionContext';

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
  const trpc = useTRPC();
  const t = useTranslations();
  const decisionTranslation = useDecisionTranslation();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<ResourceInCollection | null>(
    null,
  );
  // Mirror the server order locally so the drop animation settles into the
  // new position in the same render batch that ends the drag. The mutation's
  // onMutate awaits cancel before patching the tRPC cache, so without this
  // mirror dnd-kit snaps the item back before the optimistic update lands.
  // Sync during render (not in an effect) by tracking the source reference.
  const serverResources = data.items;
  const [resources, setResources] =
    useState<ResourceInCollection[]>(serverResources);
  const [syncedFrom, setSyncedFrom] = useState(serverResources);
  if (syncedFrom !== serverResources) {
    setSyncedFrom(serverResources);
    setResources(serverResources);
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
    () => resources.flatMap((item) => [item.title, item.description ?? '']),
    [resources],
  );
  useRegisterTranslationSamples(
    `resources:${data.collectionId ?? profileId}`,
    resourceSamples,
  );

  const reorder = useMutation(
    trpc.resources.reorder.mutationOptions({
      onMutate: async (vars) => {
        const key = { collectionId: vars.collectionId };
        await queryClient.cancelQueries(
          trpc.resources.listByCollection.queryFilter(key),
        );
        const previous = queryClient.getQueryData(
          trpc.resources.listByCollection.queryKey(key),
        );
        if (previous) {
          queryClient.setQueryData(
            trpc.resources.listByCollection.queryKey(key),
            {
              ...previous,
              items: moveItemAfter(
                previous.items,
                vars.id,
                vars.upperNeighborId,
              ),
            },
          );
        }
        return { previous, key };
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.previous && ctx?.key) {
          queryClient.setQueryData(
            trpc.resources.listByCollection.queryKey(ctx.key),
            ctx.previous,
          );
        }
        toast.error(t('Could not reorder resource'));
      },
    }),
  );

  const remove = useMutation(
    trpc.resources.delete.mutationOptions({
      onSuccess: () => toast.success(t('Resource deleted')),
      onError: () => toast.error(t('Could not delete resource')),
    }),
  );

  const collectionId = data.collectionId ?? null;

  const handleReorder = (next: ResourceInCollection[]) => {
    if (!collectionId) {
      return;
    }
    const moved = findMovedItem(resources, next);
    if (!moved) {
      return;
    }
    setResources(next);
    const upperNeighborId = next[moved.newIndex - 1]?.id ?? null;
    reorder.mutate({ id: moved.id, collectionId, upperNeighborId });
  };

  if (resources.length === 0 && !canManage) {
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
        {resources.map((resource) => (
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
        items={resources}
        renderItem={renderItem}
      >
        {resources.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input px-6 py-10 text-center text-muted-foreground">
            <LuUpload className="size-6" />
            <p className="text-sm">{t('Drag a file or link here to add it')}</p>
          </div>
        ) : (
          <Sortable
            items={resources}
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
