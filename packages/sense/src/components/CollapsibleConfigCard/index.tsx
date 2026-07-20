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
  /** Optional icon rendered after the label (the Template Card spec has none). */
  icon?: React.ComponentType<{ className?: string }>;
  /** Trigger label (text-base font-strong per the Template Card spec) */
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

  // Header per the Template Card spec: [grip|lock] Trigger Text … [Badge] [Chevron].
  // The label reads text-base font-strong and underlines on trigger hover.
  const headerContent = (
    <>
      <span
        className={cn(
          'truncate text-base font-strong',
          locked ? 'text-muted-foreground' : 'text-foreground',
          !locked && isCollapsible && 'group-hover/config-card:underline',
        )}
      >
        {label}
      </span>
      {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" /> : null}
      <span className="min-w-0 flex-1" />

      {badgeLabel && (
        <Badge variant="secondary" className={cn('shrink-0', badgeClassName)}>
          {badgeLabel}
        </Badge>
      )}

      {isCollapsible && (
        <LuChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-panel-open/config-card:rotate-180" />
      )}
    </>
  );

  // Padding lives in the header and content rows, not the card shell.
  const cardClasses = cn(
    'rounded-lg border bg-background',
    locked && 'bg-muted',
    isDragging && 'opacity-50',
    className,
  );

  // Non-collapsible: simple card
  if (!isCollapsible) {
    return (
      <div className={cardClasses}>
        <div className="flex w-full items-center gap-3 p-4">
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
      <div className="flex w-full items-center gap-3 p-4">
        {leadingElement}
        <CollapsibleTrigger className="group/config-card flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
          {headerContent}
        </CollapsibleTrigger>
      </div>
      {/* ps-11 aligns the body under the trigger text (16 pad + 16 grip + 12 gap). */}
      <CollapsibleContent>
        <div className="flex flex-col gap-4 ps-11 pe-10 pb-6">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface CollapsibleConfigCardDragPreviewProps {
  /** Optional icon rendered after the label. */
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
        <span className="truncate text-base font-strong text-foreground">
          {label}
        </span>
        {Icon ? (
          <Icon className="size-4 shrink-0 text-muted-foreground" />
        ) : null}
        <span className="min-w-0 grow" />
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
