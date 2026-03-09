'use client';

import type { ReactNode } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { LuChevronDown, LuGripVertical, LuLock } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { DragHandle } from './Sortable';
import type { SortableItemControls } from './Sortable';
import { Tooltip, TooltipTrigger } from './Tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible';

export interface CollapsibleConfigCardProps {
  /** Icon component to display in the header */
  icon: React.ComponentType<{ className?: string }>;
  /** Tooltip text for the icon */
  iconTooltip?: string;
  /** Label text shown in the header pill */
  label: string;
  /** Badge text shown as a chip (e.g. "Required" / "Optional") */
  badgeLabel?: string;
  /** Whether this card is collapsible. Default: false */
  isCollapsible?: boolean;
  /** Controlled expansion state */
  isExpanded?: boolean;
  /** Default expansion state (uncontrolled) */
  defaultExpanded?: boolean;
  /** Callback when expansion changes */
  onExpandedChange?: (expanded: boolean) => void;
  /** Sortable controls for drag-and-drop */
  controls?: SortableItemControls;
  /** Accessible label for the drag handle */
  dragHandleAriaLabel?: string;
  /** Content to render in the body (below header) */
  children?: React.ReactNode;
  /** Additional class name for the card container */
  className?: string;
  /** Whether the card is locked (non-editable, no drag handle) */
  locked?: boolean;
}

export function CollapsibleConfigCard({
  icon: Icon,
  iconTooltip,
  label,
  badgeLabel,
  isCollapsible = false,
  isExpanded,
  defaultExpanded,
  onExpandedChange,
  controls,
  dragHandleAriaLabel = 'Drag to reorder',
  children,
  className,
  locked = false,
}: CollapsibleConfigCardProps) {
  const isDragging = controls?.isDragging ?? false;

  // The leading element: drag handle for editable cards, lock icon for locked cards.
  const leadingElement = locked ? (
    <div className="flex size-6 items-center justify-center text-neutral-gray4">
      <LuLock className="size-4" />
    </div>
  ) : (
    controls && (
      <DragHandle
        {...controls.dragHandleProps}
        aria-label={dragHandleAriaLabel}
      />
    )
  );

  // The header content that acts as the collapse trigger target:
  // [Icon + Label pill] ... [Badge chip] [Chevron]
  const headerContent = (
    <>
      {/* Icon + Label pill (or plain for locked) */}
      {locked ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TooltipTrigger>
            <AriaButton className="flex shrink-0 items-center text-neutral-gray4">
              <Icon className="size-4" />
            </AriaButton>
            {iconTooltip && <Tooltip>{iconTooltip}</Tooltip>}
          </TooltipTrigger>
          <span className="truncate text-neutral-charcoal">{label}</span>
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex min-w-0 items-center gap-2 rounded bg-neutral-gray1 px-2 py-1">
            <TooltipTrigger>
              <AriaButton className="flex shrink-0 items-center text-neutral-gray4">
                <Icon className="size-4" />
              </AriaButton>
              {iconTooltip && <Tooltip>{iconTooltip}</Tooltip>}
            </TooltipTrigger>
            <span className="truncate text-neutral-charcoal">
              {label || 'Untitled field'}
            </span>
          </div>
        </div>
      )}

      {/* Badge chip */}
      {badgeLabel && (
        <span className="shrink-0 rounded-sm bg-neutral-gray1 px-2 py-0.5 text-xs text-neutral-gray4">
          {badgeLabel}
        </span>
      )}

      {/* Chevron (only when collapsible) */}
      {isCollapsible && (
        <LuChevronDown className="size-4 shrink-0 text-neutral-gray4 transition-transform duration-200 group-data-[expanded]:rotate-180" />
      )}
    </>
  );

  // Non-collapsible: simple card
  if (!isCollapsible) {
    return (
      <div
        className={cn(
          'rounded-lg border bg-white px-3 py-4',
          locked && 'bg-neutral-offWhite',
          isDragging && 'opacity-50',
          className,
        )}
      >
        <div className="flex w-full items-center gap-2">
          {leadingElement}
          {headerContent}
        </div>
        {children}
      </div>
    );
  }

  // Collapsible: drag handle sits outside the trigger so it remains interactive.
  return (
    <Collapsible
      isExpanded={isExpanded}
      defaultExpanded={defaultExpanded}
      onExpandedChange={onExpandedChange}
      className={({ isExpanded: expanded }) =>
        cn(
          'group rounded-lg border bg-white px-3 py-4',
          locked && 'bg-neutral-offWhite',
          isDragging && 'opacity-50',
          expanded && 'border-primary-teal',
          className,
        )
      }
    >
      <div className="flex w-full items-center gap-2">
        {leadingElement}
        <CollapsibleTrigger className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1">
          {headerContent}
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="pt-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export interface CollapsibleConfigCardDragPreviewProps {
  /** Icon component to display next to the label */
  icon: React.ComponentType<{ className?: string }>;
  /** The label text */
  label: string;
  /** Optional custom content to override the default preview */
  children?: ReactNode;
  /** Additional class name for the preview container */
  className?: string;
}

export function CollapsibleConfigCardDragPreview({
  icon: Icon,
  label,
  children,
  className,
}: CollapsibleConfigCardDragPreviewProps) {
  if (children) {
    return (
      <div
        className={cn('rounded-lg border bg-white p-4 shadow-lg', className)}
      >
        {children}
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border bg-white p-4 shadow-lg', className)}>
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center text-neutral-gray4">
          <LuGripVertical className="size-4" />
        </div>
        <div className="flex min-w-0 items-center gap-2 rounded bg-neutral-gray1 px-2 py-1">
          <Icon className="size-4 text-neutral-gray4" />
          <span className="text-neutral-charcoal">{label}</span>
        </div>
      </div>
    </div>
  );
}
