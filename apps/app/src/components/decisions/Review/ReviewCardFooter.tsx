import { cn } from '@op/ui/utils';
import type { ReactNode } from 'react';

export function ReviewCardFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-2', className)}>
      {children}
    </div>
  );
}
