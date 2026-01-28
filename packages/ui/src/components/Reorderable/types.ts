'use client';

import type { ReactNode } from 'react';

export interface ReorderableItem {
  id: string | number;
}

export interface ReorderableItemControls {
  /** Props to spread on a drag handle element */
  dragHandleProps: {
    slot: 'drag';
  };
  /** Whether this item is currently being dragged */
  isDragging: boolean;
  /** Whether this item is a drop target */
  isDropTarget: boolean;
  /** Index of this item in the list */
  index: number;
}

export interface ReorderableProps<T extends ReorderableItem> {
  /** Array of items to render and reorder */
  items: T[];
  /** Callback when items are reordered */
  onChange: (items: T[]) => void;
  /** How drag is triggered: 'handle' requires a drag handle, 'item' makes entire item draggable */
  dragTrigger?: 'handle' | 'item';
  /** Render function for each item */
  children: (item: T, controls: ReorderableItemControls) => ReactNode;
  /** Optional custom drag preview */
  renderDragPreview?: (items: T[]) => ReactNode;
  /** Class name for the container */
  className?: string;
  /** Class name for each item wrapper */
  itemClassName?: string;
  /** Function to get accessible label for an item */
  getItemLabel?: (item: T) => string;
  /** Accessible label for the list */
  'aria-label'?: string;
}

export interface DragHandleProps {
  /** Size of the grip icon */
  size?: number;
  /** Additional class name */
  className?: string;
}
