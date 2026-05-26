'use client';

import { Sortable } from '@op/ui/Sortable';
import { useState } from 'react';

import { DeleteResourceModal } from './DeleteResourceModal';
import { ResourceCard } from './ResourceCard';
import { ResourceOverflowMenu } from './ResourceOverflowMenu';
import { useResourceMutations } from './hooks/useResourceMutations';
import type { ResourceItem, ResourceListPayload } from './types';

export const ResourcesList = ({
  profileId,
  data,
  canManage,
}: {
  profileId: string;
  data: ResourceListPayload;
  canManage: boolean;
}) => {
  const { reorder, remove } = useResourceMutations(profileId);
  const [deleteTarget, setDeleteTarget] = useState<ResourceItem | null>(null);
  const items = data.resources;

  const handleReorder = (next: ResourceItem[]) => {
    // Find the first index where the two arrays diverge. In a single-move
    // reorder, either items[i] moved down (then items[i+1] === next[i]) or
    // next[i] moved up. Pick the moved id accordingly, then read its new
    // upper neighbor straight off `next`.
    let movedId: string | null = null;
    let movedIdxInNext = -1;
    for (let i = 0; i < next.length; i++) {
      const a = items[i];
      const b = next[i];
      if (!a || !b || a.id === b.id) continue;
      if (items[i + 1]?.id === b.id) {
        movedId = a.id;
        movedIdxInNext = next.findIndex((r) => r.id === a.id);
      } else {
        movedId = b.id;
        movedIdxInNext = i;
      }
      break;
    }
    if (!movedId || movedIdxInNext === -1) return;

    const collectionId = data.collectionId;
    if (!collectionId) return;

    const upperNeighborId = next[movedIdxInNext - 1]?.id ?? null;
    reorder.mutate({ id: movedId, collectionId, upperNeighborId });
  };

  if (items.length === 0) {
    return null;
  }

  const renderItem = (resource: ResourceItem) => (
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
          getItemLabel={(r) => r.title}
          className="gap-6"
        >
          {(resource) => renderItem(resource)}
        </Sortable>
      ) : (
        <div className="flex flex-col gap-6">
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
