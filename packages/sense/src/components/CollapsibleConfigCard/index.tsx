'use client';

import type { ReactNode } from 'react';
import { LuChevronDown, LuGripVertical, LuLock } from 'react-icons/lu';

import { cn } from '../../lib/utils';
import type { SortableItemControls } from '../Sortable';
import { DragHandle } from '../Sortable';
import { Badge } from '../ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible';

interface CollapsibleConfigCardProps {
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

function CollapsibleConfigCard({
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
  const isDragging = controls?.isDragging ?? false;

  // The leading element: drag handle for editable cards, lock icon for locked cards.
  const leadingElement = locked ? (
    <div className="flex size-6 items-center justify-center text-muted-foreground">
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
      {locked ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
          <span className="truncate text-muted-foreground">{label}</span>
        </div>
      ) : Icon ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex min-w-0 items-center gap-2 rounded-sm bg-muted px-2 py-1">
            <Icon className="size-4 shrink-0 text-foreground" />
            <span className="truncate text-foreground">{label}</span>
          </div>
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-foreground">{label}</span>
        </div>
      )}

      {badgeLabel && (
        <Badge variant="secondary" className={cn('shrink-0', badgeClassName)}>
          {badgeLabel}
        </Badge>
      )}

      {isCollapsible && (
        <LuChevronDown className="size-4 shrink-0 text-foreground transition-transform duration-200 group-data-panel-open/config-card:rotate-180" />
      )}
    </>
  );

  const cardClasses = cn(
    'rounded-lg border bg-background px-3 py-4',
    locked && 'bg-muted',
    isDragging && 'opacity-50',
    className,
  );

  // Non-collapsible: simple card
  if (!isCollapsible) {
    return (
      <div className={cardClasses}>
        <div className="flex w-full items-center gap-2">
          {leadingElement}
          {headerContent}
        </div>
        {children}
      </div>
    );
  }

  return (
    <Collapsible
      open={isExpanded}
      defaultOpen={defaultExpanded}
      onOpenChange={onExpandedChange}
      className={cardClasses}
    >
      <div className="flex w-full items-center gap-2">
        {leadingElement}
        <CollapsibleTrigger className="group/config-card flex min-w-0 flex-1 cursor-pointer items-center gap-2 pe-2 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
          {headerContent}
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="pt-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface CollapsibleConfigCardDragPreviewProps {
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

function CollapsibleConfigCardDragPreview({
  icon: Icon,
  label,
  badgeLabel,
  children,
  className,
}: CollapsibleConfigCardDragPreviewProps) {
  if (children) {
    return (
      <div
        className={cn(
          'rounded-lg border bg-background p-4 shadow-lg',
          className,
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn('rounded-lg border bg-background p-4 shadow-lg', className)}
    >
      <div className="flex items-center gap-2 pe-1">
        <div className="me-1 flex items-center justify-center text-muted-foreground">
          <LuGripVertical className="size-4" />
        </div>
        {Icon ? (
          <div className="w-full grow">
            <div className="flex w-fit shrink items-center gap-2 rounded-sm bg-muted px-2 py-1">
              <Icon className="size-4 text-muted-foreground" />
              <span className="truncate text-foreground">{label}</span>
            </div>
          </div>
        ) : (
          <span className="w-full grow truncate text-foreground">{label}</span>
        )}
        {badgeLabel && (
          <Badge variant="secondary" className="shrink-0">
            {badgeLabel}
          </Badge>
        )}
        <LuChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </div>
    </div>
  );
}

export { CollapsibleConfigCard, CollapsibleConfigCardDragPreview };
