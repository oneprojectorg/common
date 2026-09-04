'use client';

import type { ReactNode } from 'react';
import { LuCheck, LuTrash2 } from 'react-icons/lu';

import { formatDateRange } from '../../lib/formatting';
import { cn } from '../../lib/utils';
import { DragHandle } from '../Sortable/DragHandle';
import type { SortableItemControls } from '../Sortable/types';
import { Button } from '../ui/button';

export interface PhaseConfigRowProps {
  name: ReactNode;
  /** ISO date strings; both present ⇒ the row derives the configured state. */
  startDate?: string;
  endDate?: string;
  locale?: string;
  /** Override the derived state (defaults to `Boolean(startDate && endDate)`). */
  isConfigured?: boolean;
  notConfiguredLabel?: string;
  /** Edit/Configure button; defaults to "Edit" when configured, else "Configure". */
  actionLabel?: ReactNode;
  onAction?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  /** Spread Sortable's `controls.dragHandleProps` here; omit for a static row. */
  dragHandleProps?: SortableItemControls['dragHandleProps'];
  showDragHandle?: boolean;
  className?: string;
}

/**
 * A single phase row in the process builder: drag grip, serif name, and either
 * a green-check date range (configured) or "Not configured yet." (unconfigured),
 * with an Edit/Configure button and a delete affordance. Presentational — the
 * caller owns reordering, autosave, and delete confirmation. Distinct from the
 * Overview-timeline {@link PhaseCard}.
 */
export function PhaseConfigRow({
  name,
  startDate,
  endDate,
  locale,
  isConfigured,
  notConfiguredLabel = 'Not configured yet.',
  actionLabel,
  onAction,
  onDelete,
  deleteLabel = 'Delete phase',
  dragHandleProps,
  showDragHandle = true,
  className,
}: PhaseConfigRowProps) {
  const hasDates = Boolean(startDate && endDate);
  const configured = isConfigured ?? hasDates;
  const resolvedActionLabel =
    actionLabel ?? (configured ? 'Edit' : 'Configure');

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card p-4',
        className,
      )}
    >
      {showDragHandle ? <DragHandle {...dragHandleProps} /> : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-serif text-label text-foreground">
          {name}
        </span>
        {configured ? (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <LuCheck className="size-4 shrink-0 text-success" aria-hidden />
            {hasDates ? formatDateRange(startDate!, endDate!, locale) : null}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            {notConfiguredLabel}
          </span>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={onAction}>
        {resolvedActionLabel}
      </Button>
      {onDelete ? (
        <Button
          variant="destructive"
          size="icon-sm"
          aria-label={deleteLabel}
          onClick={onDelete}
        >
          <LuTrash2 />
        </Button>
      ) : null}
    </div>
  );
}
