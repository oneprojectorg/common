'use client';

import { forwardRef } from 'react';
import { LuGripVertical } from 'react-icons/lu';
import { tv } from 'tailwind-variants';

import type { DragHandleProps } from './types';

const dragHandleStyles = tv({
  base: 'flex cursor-grab touch-none items-center justify-center rounded p-1 text-neutral-gray4 transition-colors outline-none hover:bg-neutral-offWhite hover:text-neutral-charcoal focus-visible:ring-2 focus-visible:ring-primary-teal active:cursor-grabbing',
});

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
      className={dragHandleStyles({ className })}
      {...props}
    >
      <LuGripVertical size={size} />
    </button>
  );
});
