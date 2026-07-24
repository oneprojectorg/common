'use client';

import { forwardRef } from 'react';
import { LuGripVertical } from 'react-icons/lu';

import { cn } from '../../lib/utils';
import type { DragHandleProps } from './types';

// Mirrors the ghost icon-button family (text-foreground, rounded-md, muted
// hover) plus the drag-only affordances base-ui Button can't carry.
const dragHandleClasses =
  'flex cursor-grab touch-none items-center justify-center rounded-md p-1 text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing';

export const DragHandle = forwardRef<
  HTMLButtonElement,
  DragHandleProps &
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'>
>(function DragHandle(
  {
    size = 16,
    className,
    'aria-label': ariaLabel = 'Drag to reorder',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={ariaLabel}
      className={cn(dragHandleClasses, className)}
      {...props}
    >
      <LuGripVertical size={size} />
    </button>
  );
});
