'use client';

import type { ResourceInCollection } from '@op/api/encoders';
import { httpUrlSchema } from '@op/common/client';
import { type ReactNode, useRef, useState } from 'react';

import { ResourceCardSkeleton } from './ResourceCardSkeleton';
import { useResourceDrop } from './hooks/useResourceDrop';
import { extractDropUrl } from './utils';

// dataTransfer types that mean "a file or link is being dragged in" — anything
// else (e.g. internal dnd-kit reordering, which uses pointer events, not native
// HTML5 drag) is ignored so we don't hijack unrelated drags.
const DROP_TYPES = new Set(['Files', 'text/uri-list', 'text/plain']);

const isAcceptedDrag = (dataTransfer: DataTransfer | null): boolean => {
  if (!dataTransfer) {
    return false;
  }
  return Array.from(dataTransfer.types).some((type) => DROP_TYPES.has(type));
};

// Wraps a collection's content (or an empty-state) and turns it into a native
// file/link drop target. While dragging, it swaps to a plain list that splices
// a card-sized placeholder at the cursor's sort point; on drop it runs the same
// create flow as Add Resource, positioned at that slot. Coexists with the
// dnd-kit reorder Sortable, which uses pointer events untouched by OS drags.
export const ResourceDropZone = ({
  profileId,
  collectionId,
  items,
  renderItem,
  children,
}: {
  profileId: string;
  // null when there is no collection yet (empty panel) — the drop lazily
  // creates the Default collection and lands at the top.
  collectionId: string | null;
  items: ResourceInCollection[];
  renderItem?: (resource: ResourceInCollection) => ReactNode;
  children: ReactNode;
}) => {
  const { pending, dropFiles, dropLink } = useResourceDrop({
    profileId,
    collectionId,
  });
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isFileDragging, setIsFileDragging] = useState(false);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // Sort point = number of cards whose vertical midpoint sits above the cursor.
  // Measures the real cards (tagged data-resource-card), so the placeholder we
  // inject doesn't perturb the calculation. Range: [0, items.length].
  const computeDropIndex = (clientY: number): number => {
    const container = dropZoneRef.current;
    if (!container) {
      return items.length;
    }
    const cards = container.querySelectorAll('[data-resource-card]');
    let index = 0;
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (clientY > rect.top + rect.height / 2) {
        index += 1;
      } else {
        break;
      }
    }
    return index;
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isAcceptedDrag(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    if (!isFileDragging) {
      setIsFileDragging(true);
    }
    const next = computeDropIndex(event.clientY);
    setDropIndex((prev) => (prev === next ? prev : next));
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    // Only reset when the pointer actually leaves the drop zone, not when it
    // crosses between child cards (which fires dragleave on the old child).
    const nextTarget =
      event.relatedTarget instanceof Node ? event.relatedTarget : null;
    if (!dropZoneRef.current?.contains(nextTarget)) {
      setIsFileDragging(false);
      setDropIndex(null);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isAcceptedDrag(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    const slot = computeDropIndex(event.clientY);
    // Without a collection there is no sort slot to honor yet (the create lands
    // at the top of the lazily-created Default collection).
    const upperNeighborId = collectionId ? (items[slot - 1]?.id ?? null) : null;
    setIsFileDragging(false);
    setDropIndex(null);

    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length > 0) {
      void dropFiles(files, upperNeighborId, slot);
      return;
    }
    const url = extractDropUrl(event.dataTransfer);
    if (url && httpUrlSchema.safeParse(url).success) {
      void dropLink(url, upperNeighborId, slot);
    }
  };

  // Slots (0..items.length) that should render a placeholder skeleton: the live
  // drag target plus any in-flight drops.
  const skeletonSlots = [
    ...(isFileDragging && dropIndex !== null ? [dropIndex] : []),
    ...pending.map((entry) => entry.index),
  ];
  const showPlaceholders = skeletonSlots.length > 0;

  const skeletonsAt = (slot: number): ReactNode[] =>
    skeletonSlots
      .filter((value) => value === slot)
      .map((_, occurrence) => (
        <ResourceCardSkeleton key={`skeleton-${slot}-${occurrence}`} />
      ));

  const renderWithPlaceholders = (): ReactNode[] => {
    const rows: ReactNode[] = [];
    for (let slot = 0; slot <= items.length; slot++) {
      rows.push(...skeletonsAt(slot));
      const resource = items[slot];
      if (resource && renderItem) {
        rows.push(
          <div key={resource.id} data-resource-card>
            {renderItem(resource)}
          </div>,
        );
      }
    }
    return rows;
  };

  return (
    <div
      ref={dropZoneRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex flex-col gap-4 rounded-lg"
    >
      {showPlaceholders ? renderWithPlaceholders() : children}
    </div>
  );
};
