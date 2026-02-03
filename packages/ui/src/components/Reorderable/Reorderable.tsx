'use client';

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { tv } from 'tailwind-variants';

import type {
  ReorderableItem,
  ReorderableItemControls,
  ReorderableProps,
} from './types';

const reorderableStyles = tv({
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

interface SortableItemProps<T extends ReorderableItem> {
  item: T;
  index: number;
  dragTrigger: 'handle' | 'item';
  children: (item: T, controls: ReorderableItemControls) => React.ReactNode;
  itemClassName?: string;
  getItemLabel?: (item: T) => string;
  useDragOverlay: boolean;
  showDropPlaceholder: boolean;
  dropPlaceholderClassName?: string;
}

function SortableItem<T extends ReorderableItem>({
  item,
  index,
  dragTrigger,
  children,
  itemClassName,
  getItemLabel,
  useDragOverlay,
  showDropPlaceholder,
  dropPlaceholderClassName,
}: SortableItemProps<T>) {
  const styles = reorderableStyles();
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

  const controls: ReorderableItemControls = {
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

export function Reorderable<T extends ReorderableItem>({
  items,
  onChange,
  dragTrigger = 'handle',
  children,
  renderDragPreview,
  spaceBetweenItems = 0,
  className,
  itemClassName,
  getItemLabel,
  'aria-label': ariaLabel = 'Reorderable list',
  showDropPlaceholder = false,
  dropPlaceholderClassName,
}: ReorderableProps<T>) {
  const styles = reorderableStyles();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => String(item.id) === active.id);
      const newIndex = items.findIndex((item) => String(item.id) === over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);
      onChange(newItems);
    }

    setActiveId(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const activeItem = activeId
    ? items.find((item) => String(item.id) === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext
        items={items.map((item) => String(item.id))}
        strategy={verticalListSortingStrategy}
      >
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={styles.container({ className })}
          style={{ gap: spaceBetweenItems }}
        >
          {items.map((item, index) => (
            <SortableItem
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
            </SortableItem>
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
                    index: items.findIndex((i) => i.id === activeItem.id),
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
