import type { ReactNode } from 'react';

export interface SortableItem {
  id: string | number;
}

export interface SortableItemControls {
  /** Props to spread on a drag handle element (use with DragHandle component) */
  dragHandleProps: {
    ref: (node: HTMLElement | null) => void;
    tabIndex: number;
    role: string;
    'aria-roledescription': string;
    'aria-describedby': string;
    'aria-disabled': boolean;
    'aria-pressed': boolean | undefined;
  } & Record<string, unknown>;
  /** Whether this item is currently being dragged */
  isDragging: boolean;
  /** Whether this item is a drop target */
  isDropTarget: boolean;
  /** Index of this item in the list */
  index: number;
}

export interface SortableProps<T extends SortableItem> {
  /** Array of items to render and reorder */
  items: T[];
  /** Callback when items are reordered */
  onChange: (items: T[]) => void;
  /** How drag is triggered: 'handle' requires a drag handle, 'item' makes entire item draggable */
  dragTrigger?: 'handle' | 'item';
  /** Render function for each item */
  children: (item: T, controls: SortableItemControls) => ReactNode;
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
  /**
   * How to indicate where the dragged item will be dropped:
   * - 'none': No visual indicator (default)
   * - 'placeholder': Show a placeholder matching the dragged item's size
   * - 'line': Show a thin line between items
   */
  dropIndicator?: 'placeholder' | 'line' | 'none';
  /** Class name for the drop placeholder (only used when dropIndicator='placeholder') */
  dropPlaceholderClassName?: string;
}

export interface DragHandleProps {
  /** Size of the grip icon */
  size?: number;
  /** Additional class name */
  className?: string;
}
