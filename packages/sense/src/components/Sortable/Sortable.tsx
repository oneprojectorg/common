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

import { cn } from '../../lib/utils';
import type {
  DropIndicatorProps,
  SortableItem,
  SortableItemControls,
  SortableProps,
} from './types';

const containerClasses = 'flex flex-col outline-none';

const itemClasses = (hasDragHandle: boolean) =>
  cn('relative outline-none', !hasDragHandle && 'cursor-grab touch-none');

interface SortableItemWrapperProps<T extends SortableItem> {
  item: T;
  index: number;
  dragTrigger: 'handle' | 'item';
  children: (item: T, controls: SortableItemControls) => React.ReactNode;
  itemClassName?: string;
  getItemLabel?: (item: T) => string;
  renderDropIndicator?: (props: DropIndicatorProps<T>) => React.ReactNode;
}

function SortableItemWrapper<T extends SortableItem>({
  item,
  index,
  dragTrigger,
  children,
  itemClassName,
  getItemLabel,
  renderDropIndicator,
}: SortableItemWrapperProps<T>) {
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

  // When item is being dragged, show drop indicator or default behavior
  if (isDragging) {
    const itemContent = children(item, controls);

    if (renderDropIndicator) {
      return (
        <div ref={setNodeRef} style={style} role="listitem">
          {renderDropIndicator({ item, children: itemContent })}
        </div>
      );
    }

    // Default: keep the space but hide the content
    return (
      <div ref={setNodeRef} style={style} role="listitem">
        <div style={{ visibility: 'hidden' }}>{itemContent}</div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(itemClasses(dragTrigger === 'handle'), itemClassName)}
      {...itemProps}
      // After the spread: dnd-kit's attributes carry role="button" in item
      // mode, but the wrapper must stay a listitem for a valid list tree.
      role="listitem"
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
  renderDropIndicator,
}: SortableProps<T>) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  // dnd-kit's default context id is a module-level counter, which produces
  // mismatched aria ids across SSR/hydration in Next — useId is stable.
  const dndContextId = React.useId();

  // Without activation constraints the pointer sensors swallow the initial
  // mousedown/touchstart, which blocks clicks on interactive children (e.g.
  // an <a> inside a dragTrigger="item" card). A small distance threshold
  // lets a stationary click pass through; touch waits briefly so taps and
  // scrolls aren't hijacked.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
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
      // active.id/over.id are UniqueIdentifier (string | number); items
      // register as String(item.id), so normalize both sides before compare.
      const oldIndex = items.findIndex(
        (item) => String(item.id) === String(active.id),
      );
      const newIndex = items.findIndex(
        (item) => String(item.id) === String(over.id),
      );
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
      id={dndContextId}
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
          role="list"
          aria-label={ariaLabel}
          className={cn(containerClasses, className)}
        >
          {items.map((item, index) => (
            <SortableItemWrapper
              key={String(item.id)}
              item={item}
              index={index}
              dragTrigger={dragTrigger}
              itemClassName={itemClassName}
              getItemLabel={getItemLabel}
              renderDropIndicator={renderDropIndicator}
            >
              {children}
            </SortableItemWrapper>
          ))}
        </div>
      </SortableContext>

      {typeof document !== 'undefined' &&
        createPortal(
          // Portals to document.body, outside any `.sense` wrapper — the
          // overlay re-scopes itself so the preview matches the in-list item.
          <DragOverlay className="sense">
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
