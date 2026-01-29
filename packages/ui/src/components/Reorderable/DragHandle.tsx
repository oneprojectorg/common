'use client';

import { Button } from 'react-aria-components';
import { LuGripVertical } from 'react-icons/lu';
import { tv } from 'tailwind-variants';

import type { DragHandleProps } from './types';

const dragHandleStyles = tv({
  base: 'flex cursor-grab items-center justify-center rounded p-1 text-neutral-500 transition-colors outline-none hover:bg-neutral-100 hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-primary-teal active:cursor-grabbing',
});

export function DragHandle({ size = 16, className }: DragHandleProps) {
  return (
    <Button slot="drag" className={dragHandleStyles({ className })}>
      <LuGripVertical size={size} />
    </Button>
  );
}
