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
    // Find the first index where the two arrays diverge — that anchor tells us
    // which item moved without resorting to a fragile "max-delta" heuristic
    // (which is non-deterministic for two-element swaps).
    let from = -1;
    let to = -1;
    for (let i = 0; i < next.length; i++) {
      const a = items[i];
      const b = next[i];
      if (!a || !b || a.id === b.id) continue;
      if (items[i + 1]?.id === b.id) {
        from = i;
        to = next.findIndex((r) => r.id === a.id);
      } else {
        to = i;
        from = items.findIndex((r) => r.id === b.id);
      }
      break;
    }
    if (from === -1 || to === -1 || from === to) return;
    const movedId = items[from]?.id;
    if (!movedId) return;

    const collectionId = data.collectionId;
    if (!collectionId) return;

    if (to === 0) {
      const after = next[1];
      if (!after) return;
      reorder.mutate({ id: movedId, collectionId, afterId: after.id });
      return;
    }
    const before = next[to - 1];
    if (!before) return;
    reorder.mutate({ id: movedId, collectionId, beforeId: before.id });
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
