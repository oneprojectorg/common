'use client';

import type { DropIndicatorProps, SortableItem } from './types';

/**
 * A thin line indicator showing where the item will be dropped.
 * Best for lists with variable height items.
 */
export function DropIndicatorLine<T extends SortableItem>(
  _props: DropIndicatorProps<T>,
) {
  return <div className="my-1 h-0.5 rounded-full bg-primary" />;
}

/**
 * A placeholder that matches the size of the dragged item.
 * Shows a dashed border where the item will be dropped.
 */
export function DropIndicatorPlaceholder<T extends SortableItem>({
  children,
}: DropIndicatorProps<T>) {
  return (
    <div className="rounded-lg border-1 border-dashed border-primary/40 bg-primary/20">
      <div style={{ visibility: 'hidden' }}>{children}</div>
    </div>
  );
}
