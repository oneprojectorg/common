'use client';

import {
  type ClientRect,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  DragOverlay,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type UniqueIdentifier,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { tv } from 'tailwind-variants';

import type {
  SortableItem,
  SortableItemControls,
  SortableProps,
} from './types';

const sortableStyles = tv({
  slots: {
    container: 'flex flex-col outline-none',
    item: 'relative outline-none',
    dropPlaceholder:
      'rounded-lg border-1 border-dashed border-primary/40 bg-primary/20',
  },
  variants: {
    isDragging: {
      true: {
        item: 'opacity-40',
      },
    },
    hasDragHandle: {
      true: {
        item: '',
      },
      false: {
        item: 'cursor-grab touch-none',
      },
    },
  },
});

/**
 * Custom keyboard coordinate getter that moves directly to the next/previous
 * item's position. This fixes the default dnd-kit behavior where variable
 * height items don't move far enough to trigger reordering.
 *
 * The coordinate getter returns the NEW position for the collision rect's
 * top-left corner (not a delta, not the center).
 */
const customKeyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  { context: { active, collisionRect, droppableRects, droppableContainers } },
) => {
  if (!['ArrowUp', 'ArrowDown'].includes(event.code)) {
    return undefined;
  }

  event.preventDefault();

  if (!active || !collisionRect) {
    return undefined;
  }

  const isMovingDown = event.code === 'ArrowDown';

  // Get all droppable containers with their rects
  const containers = [...droppableContainers.getEnabled()]
    .map((container) => ({
      id: container.id,
      rect: droppableRects.get(container.id),
    }))
    .filter(
      (item): item is { id: UniqueIdentifier; rect: ClientRect } =>
        item.rect !== undefined && item.id !== active.id,
    );

  // Filter to only containers in the direction we're moving
  const collisionCenterY = collisionRect.top + collisionRect.height / 2;

  const containersInDirection = containers.filter(({ rect }) => {
    const targetCenterY = rect.top + rect.height / 2;
    if (isMovingDown) {
      return targetCenterY > collisionCenterY;
    } else {
      return targetCenterY < collisionCenterY;
    }
  });

  if (containersInDirection.length === 0) {
    return undefined;
  }

  // Find the closest container in that direction (by center distance)
  const closest = containersInDirection.reduce((prev, curr) => {
    const prevCenterY = prev.rect.top + prev.rect.height / 2;
    const currCenterY = curr.rect.top + curr.rect.height / 2;
    const prevDistance = Math.abs(prevCenterY - collisionCenterY);
    const currDistance = Math.abs(currCenterY - collisionCenterY);
    return currDistance < prevDistance ? curr : prev;
  });

  const targetCenterY = closest.rect.top + closest.rect.height / 2;

  // Return coordinates for collision rect's top-left corner such that
  // our center aligns with the target's center.
  // Keep X the same (just use current collision rect's left position)
  return {
    x: collisionRect.left,
    y: targetCenterY - collisionRect.height / 2,
  };
};

interface SortableItemWrapperProps<T extends SortableItem> {
  item: T;
  index: number;
  dragTrigger: 'handle' | 'item';
  children: (item: T, controls: SortableItemControls) => React.ReactNode;
  itemClassName?: string;
  getItemLabel?: (item: T) => string;
  useDragOverlay: boolean;
  showDropPlaceholder: boolean;
  dropPlaceholderClassName?: string;
}

function SortableItemWrapper<T extends SortableItem>({
  item,
  index,
  dragTrigger,
  children,
  itemClassName,
  getItemLabel,
  useDragOverlay,
  showDropPlaceholder,
  dropPlaceholderClassName,
}: SortableItemWrapperProps<T>) {
  const styles = sortableStyles();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: String(item.id),
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // When using a handle, the handle gets the listeners
  // When using item mode, the item wrapper gets the listeners
  const dragHandleProps =
    dragTrigger === 'handle'
      ? {
          ref: setActivatorNodeRef,
          ...attributes,
          ...listeners,
        }
      : {
          ref: () => {},
          ...attributes,
        };

  const itemProps =
    dragTrigger === 'item'
      ? {
          ...attributes,
          ...listeners,
          'aria-label': getItemLabel?.(item) ?? String(item.id),
        }
      : {};

  const controls: SortableItemControls = {
    dragHandleProps,
    isDragging,
    isDropTarget: isOver,
    index,
  };

  // When using DragOverlay, show placeholder where item will drop
  if (useDragOverlay && isDragging) {
    if (showDropPlaceholder) {
      return (
        <div
          ref={setNodeRef}
          style={style}
          className={styles.dropPlaceholder({
            className: dropPlaceholderClassName,
          })}
        >
          {/* Invisible content to maintain height */}
          <div style={{ visibility: 'hidden' }}>{children(item, controls)}</div>
        </div>
      );
    }
    // Hide the original item when not showing placeholder
    style.opacity = 0;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={styles.item({
        isDragging: !useDragOverlay && isDragging,
        hasDragHandle: dragTrigger === 'handle',
        className: itemClassName,
      })}
      {...itemProps}
    >
      {children(item, controls)}
    </div>
  );
}

export function Sortable<T extends SortableItem>({
  items,
  onChange,
  dragTrigger = 'handle',
  children,
  renderDragPreview,
  className,
  itemClassName,
  getItemLabel,
  'aria-label': ariaLabel = 'Sortable list',
  showDropPlaceholder = false,
  dropPlaceholderClassName,
}: SortableProps<T>) {
  const styles = sortableStyles();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  // Track items internally for live reordering during keyboard drag
  const [internalItems, setInternalItems] = useState(items);

  // Sync internal items when external items change (but not during drag)
  React.useEffect(() => {
    if (!activeId) {
      setInternalItems(items);
    }
  }, [items, activeId]);

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: customKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
    setInternalItems(items);
  };

  // Handle live reordering during drag (especially for keyboard)
  const handleDragMove = (event: DragMoveEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setInternalItems((currentItems) => {
        const oldIndex = currentItems.findIndex(
          (item) => String(item.id) === active.id,
        );
        const newIndex = currentItems.findIndex(
          (item) => String(item.id) === over.id,
        );

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          return arrayMove(currentItems, oldIndex, newIndex);
        }
        return currentItems;
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = internalItems.findIndex(
        (item) => String(item.id) === active.id,
      );
      const newIndex = internalItems.findIndex(
        (item) => String(item.id) === over.id,
      );
      const newItems = arrayMove(internalItems, oldIndex, newIndex);
      onChange(newItems);
    } else {
      // Even if no change in position, commit the current internal state
      onChange(internalItems);
    }

    setActiveId(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setInternalItems(items); // Reset to original order
  };

  const activeItem = activeId
    ? internalItems.find((item) => String(item.id) === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext
        items={internalItems.map((item) => String(item.id))}
        strategy={verticalListSortingStrategy}
      >
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={styles.container({ className })}
        >
          {internalItems.map((item, index) => (
            <SortableItemWrapper
              key={String(item.id)}
              item={item}
              index={index}
              dragTrigger={dragTrigger}
              itemClassName={itemClassName}
              getItemLabel={getItemLabel}
              useDragOverlay={true}
              showDropPlaceholder={showDropPlaceholder}
              dropPlaceholderClassName={dropPlaceholderClassName}
            >
              {children}
            </SortableItemWrapper>
          ))}
        </div>
      </SortableContext>

      {typeof document !== 'undefined' &&
        createPortal(
          <DragOverlay>
            {activeItem ? (
              renderDragPreview ? (
                renderDragPreview([activeItem])
              ) : (
                <div style={{ cursor: 'grabbing' }}>
                  {children(activeItem, {
                    dragHandleProps: {
                      ref: () => {},
                      tabIndex: -1,
                      role: 'button',
                      'aria-roledescription': 'sortable',
                      'aria-describedby': '',
                      'aria-disabled': true,
                      'aria-pressed': undefined,
                    },
                    isDragging: true,
                    isDropTarget: false,
                    index: internalItems.findIndex((i) => i.id === activeItem.id),
                  })}
                </div>
              )
            ) : null}
          </DragOverlay>,
          document.body,
        )}
    </DndContext>
  );
}
