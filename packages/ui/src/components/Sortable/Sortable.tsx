'use client';

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  type Modifier,
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
    // The line indicator: shown in place of the dragged item
    dropLine: 'relative my-1 h-0.5 rounded-full bg-primary',
  },
  variants: {
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
 * Modifier to adjust the drag overlay position when using line indicator mode.
 * Shifts the overlay up slightly so it doesn't cover the line.
 */
const adjustTranslate: Modifier = ({ transform }) => {
  return {
    ...transform,
    y: transform.y - 25,
  };
};

interface SortableItemWrapperProps<T extends SortableItem> {
  item: T;
  index: number;
  dragTrigger: 'handle' | 'item';
  children: (item: T, controls: SortableItemControls) => React.ReactNode;
  itemClassName?: string;
  getItemLabel?: (item: T) => string;
  dropIndicator: 'placeholder' | 'line' | 'none';
  dropPlaceholderClassName?: string;
}

function SortableItemWrapper<T extends SortableItem>({
  item,
  index,
  dragTrigger,
  children,
  itemClassName,
  getItemLabel,
  dropIndicator,
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

  // When item is being dragged, show appropriate indicator
  if (isDragging) {
    if (dropIndicator === 'placeholder') {
      // Show a placeholder matching the item's size
      return (
        <div
          ref={setNodeRef}
          style={style}
          className={styles.dropPlaceholder({
            className: dropPlaceholderClassName,
          })}
        >
          <div style={{ visibility: 'hidden' }}>{children(item, controls)}</div>
        </div>
      );
    }

    if (dropIndicator === 'line') {
      // Show a thin line where the item will be placed
      return (
        <div ref={setNodeRef} style={style} className={styles.dropLine()} />
      );
    }

    // 'none' mode: keep the space but hide the content
    return (
      <div ref={setNodeRef} style={style}>
        <div style={{ visibility: 'hidden' }}>{children(item, controls)}</div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={styles.item({
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
  dropIndicator = 'none',
  dropPlaceholderClassName,
}: SortableProps<T>) {
  const styles = sortableStyles();
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
        >
          {items.map((item, index) => (
            <SortableItemWrapper
              key={String(item.id)}
              item={item}
              index={index}
              dragTrigger={dragTrigger}
              itemClassName={itemClassName}
              getItemLabel={getItemLabel}
              dropIndicator={dropIndicator}
              dropPlaceholderClassName={dropPlaceholderClassName}
            >
              {children}
            </SortableItemWrapper>
          ))}
        </div>
      </SortableContext>

      {typeof document !== 'undefined' &&
        createPortal(
          <DragOverlay
            modifiers={dropIndicator === 'line' ? [adjustTranslate] : undefined}
          >
            {activeItem ? (
              renderDragPreview ? (
                renderDragPreview([activeItem])
              ) : (
                <div
                  style={{
                    cursor: 'grabbing',
                    opacity: dropIndicator === 'line' ? 0.8 : 1,
                  }}
                >
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
