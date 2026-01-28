'use client';

import {
  Button,
  GridList,
  GridListItem,
  useDragAndDrop,
} from 'react-aria-components';
import { useListData } from 'react-stately';
import { tv } from 'tailwind-variants';

import type {
  ReorderableItem,
  ReorderableItemControls,
  ReorderableProps,
} from './types';

const reorderableStyles = tv({
  slots: {
    container: 'flex flex-col outline-none [&_.react-aria-DropIndicator]:h-0 [&_.react-aria-DropIndicator]:w-full [&_.react-aria-DropIndicator]:outline-2 [&_.react-aria-DropIndicator]:outline-primary-teal [&_.react-aria-DropIndicator[data-drop-target]]:outline',
    item: 'relative transition-all duration-200 outline-none',
  },
  variants: {
    isDragging: {
      true: {
        item: 'opacity-50',
      },
    },
    isDropTarget: {
      true: {
        item: 'ring-2 ring-primary-teal ring-offset-2',
      },
    },
  },
});

export function Reorderable<T extends ReorderableItem>({
  items,
  onChange,
  dragTrigger = 'handle',
  children,
  renderDragPreview,
  className,
  itemClassName,
  getItemLabel,
  'aria-label': ariaLabel = 'Reorderable list',
}: ReorderableProps<T>) {
  const styles = reorderableStyles();

  const list = useListData({
    initialItems: items,
    getKey: (item) => String(item.id),
  });

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) =>
      [...keys].map((key) => ({
        'text/plain': String(key),
      })),
    onReorder(e) {
      // Compute new order synchronously before calling list methods
      const draggedKeys = new Set([...e.keys].map(String));
      const targetKey = String(e.target.key);

      // Get items not being dragged
      const remainingItems = list.items.filter(
        (item) => !draggedKeys.has(String(item.id)),
      );
      // Get dragged items in their original order
      const draggedItems = list.items.filter((item) =>
        draggedKeys.has(String(item.id)),
      );

      // Find target position in remaining items
      const targetIndex = remainingItems.findIndex(
        (item) => String(item.id) === targetKey,
      );

      // Insert dragged items at the correct position
      const newItems = [...remainingItems];
      const insertIndex =
        e.target.dropPosition === 'before' ? targetIndex : targetIndex + 1;
      newItems.splice(insertIndex, 0, ...draggedItems);

      // Update the list state
      if (e.target.dropPosition === 'before') {
        list.moveBefore(e.target.key, e.keys);
      } else if (e.target.dropPosition === 'after') {
        list.moveAfter(e.target.key, e.keys);
      }

      onChange(newItems as T[]);
    },
    renderDragPreview: renderDragPreview
      ? (dragItems) => {
          const matchedItems = dragItems
            .map((dragItem) =>
              list.items.find(
                (item) => String(item.id) === dragItem['text/plain'],
              ),
            )
            .filter(Boolean) as T[];
          return <>{renderDragPreview(matchedItems)}</>;
        }
      : undefined,
  });

  return (
    <GridList
      aria-label={ariaLabel}
      items={list.items}
      dragAndDropHooks={dragAndDropHooks}
      className={styles.container({ className })}
      selectionMode="none"
    >
      {(item) => {
        const index = list.items.findIndex((i) => i.id === item.id);

        return (
          <GridListItem
            key={String(item.id)}
            id={String(item.id)}
            textValue={getItemLabel ? getItemLabel(item as T) : String(item.id)}
            className={(renderProps) =>
              styles.item({
                isDragging: renderProps.isDragging,
                isDropTarget: renderProps.isDropTarget,
                className: itemClassName,
              })
            }
          >
            {(renderProps) => {
              const controls: ReorderableItemControls = {
                dragHandleProps: {
                  slot: 'drag' as const,
                },
                isDragging: renderProps.isDragging ?? false,
                isDropTarget: renderProps.isDropTarget ?? false,
                index,
              };

              if (dragTrigger === 'item') {
                return (
                  <Button
                    slot="drag"
                    className="w-full cursor-grab active:cursor-grabbing"
                  >
                    {children(item as T, controls)}
                  </Button>
                );
              }

              return children(item as T, controls);
            }}
          </GridListItem>
        );
      }}
    </GridList>
  );
}
