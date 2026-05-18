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

export interface DropIndicatorProps<T extends SortableItem> {
  /** The item being dragged */
  item: T;
  /** Render the item content (useful for size-matching placeholders) */
  children: ReactNode;
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
   * Component to render as the drop indicator while dragging.
   * Receives the item being dragged and a children prop containing the item content
   * (useful for size-matching placeholders).
   * If not provided, the item's space is preserved but content is hidden.
   */
  renderDropIndicator?: (props: DropIndicatorProps<T>) => ReactNode;
}

export interface DragHandleProps {
  /** Size of the grip icon */
  size?: number;
  /** Additional class name */
  className?: string;
  /** Accessible label for the drag handle (defaults to "Drag to reorder") */
  'aria-label'?: string;
}
