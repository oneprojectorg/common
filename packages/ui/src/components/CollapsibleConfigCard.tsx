'use client';

import type { ReactNode } from 'react';
import { useId } from 'react';
import { LuChevronDown, LuGripVertical, LuLock } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { Chip } from './Chip';
import { DragHandle } from './Sortable';
import type { SortableItemControls } from './Sortable';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';

export interface CollapsibleConfigCardProps {
  /** Icon component to display in the header. When omitted, label renders as plain text (no pill). */
  icon?: React.ComponentType<{ className?: string }>;
  /** Label text shown in the header pill (or plain text when no icon) */
  label: string;
  /** Badge text shown as a chip (e.g. "Required" / "Optional") */
  badgeLabel?: string;
  /** Additional class name for the badge chip */
  badgeClassName?: string;
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
  label,
  badgeLabel,
  badgeClassName,
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
  const autoId = useId();
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
      {/* Icon + Label pill (or plain text when no icon) */}
      {locked ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {Icon && <Icon className="size-4 shrink-0 text-neutral-gray4" />}
          <span className="truncate text-neutral-charcoal">{label}</span>
        </div>
      ) : Icon ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex min-w-0 items-center gap-2 rounded bg-neutral-gray1 px-2 py-1">
            <Icon className="size-4 shrink-0 text-neutral-charcoal" />
            <span className="truncate text-neutral-black">{label}</span>
          </div>
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-neutral-black">{label}</span>
        </div>
      )}

      {/* Badge chip */}
      {badgeLabel && (
        <Chip className={cn('shrink-0', badgeClassName)}>{badgeLabel}</Chip>
      )}

      {/* Chevron (only when collapsible) */}
      {isCollapsible && (
        <LuChevronDown className="size-4 shrink-0 text-neutral-charcoal transition-transform duration-200 group-data-[expanded]/accordion-item:rotate-180" />
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

  // Collapsible: standalone AccordionItem with unstyled variant so we control all styling.
  return (
    <AccordionItem
      id={autoId}
      variant="unstyled"
      isExpanded={isExpanded}
      defaultExpanded={defaultExpanded}
      onExpandedChange={onExpandedChange}
      className={cn(
        'rounded-lg border bg-white px-3 py-4',
        locked && 'bg-neutral-offWhite',
        isDragging && 'opacity-50',
        className,
      )}
    >
      <div className="flex w-full items-center gap-2">
        {leadingElement}
        <AccordionTrigger className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 pr-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1">
          {headerContent}
        </AccordionTrigger>
      </div>
      <AccordionContent>
        <div className="pt-4">{children}</div>
      </AccordionContent>
    </AccordionItem>
  );
}

export interface CollapsibleConfigCardDragPreviewProps {
  /** Icon component to display next to the label. When omitted, label renders as plain text. */
  icon?: React.ComponentType<{ className?: string }>;
  /** The label text */
  label: string;
  /** Badge text shown as a chip (e.g. "Required" / "Optional") */
  badgeLabel?: string;
  /** Optional custom content to override the default preview */
  children?: ReactNode;
  /** Additional class name for the preview container */
  className?: string;
}

export function CollapsibleConfigCardDragPreview({
  icon: Icon,
  label,
  badgeLabel,
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
      <div className="flex items-center gap-2 pr-1">
        <div className="mr-1 flex items-center justify-center text-neutral-gray4">
          <LuGripVertical className="size-4" />
        </div>
        {Icon ? (
          <div className="w-full grow">
            <div className="flex w-fit shrink items-center gap-2 rounded bg-neutral-gray1 px-2 py-1">
              <Icon className="size-4 text-neutral-gray4" />
              <span className="truncate text-neutral-charcoal">{label}</span>
            </div>
          </div>
        ) : (
          <span className="w-full grow truncate text-neutral-charcoal">
            {label}
          </span>
        )}
        {badgeLabel && (
          <Chip className="shrink-0 text-neutral-gray4">{badgeLabel}</Chip>
        )}
        <LuChevronDown className="size-4 shrink-0 text-neutral-gray4" />
      </div>
    </div>
  );
}
