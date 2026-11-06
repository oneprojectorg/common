'use client';

import { SheetFooter } from '@op/sense/Sheet';
import { cn } from '@op/sense/lib/utils';
import type { ComponentProps } from 'react';

/** Sits under the scroll region, so it stays in view while the body scrolls. */
export function ProposalSheetFooter({
  className,
  ...props
}: ComponentProps<typeof SheetFooter>) {
  return (
    <SheetFooter
      className={cn('flex-row items-center justify-between gap-4', className)}
      {...props}
    />
  );
}
