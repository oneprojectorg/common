'use client';

import { cn } from '@op/ui/utils';
import type { ReactNode } from 'react';

/**
 * Mobile card chrome used to render a proposal in a vertically-stacked
 * selectable list (the small-screen counterpart to a selectable table row).
 */
export function SelectionCard({
  isSelected,
  className,
  children,
}: {
  isSelected: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-4',
        isSelected
          ? 'border-primary-teal bg-primary-tealWhite'
          : 'border-neutral-gray1 bg-white',
        className,
      )}
    >
      {children}
    </div>
  );
}
