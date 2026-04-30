import { ReactNode } from 'react';

import { cn } from '../lib/utils';

export const Chip = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <span
      className={cn(
        'items-center rounded-md bg-accent p-1 text-xs text-foreground',
        className,
      )}
    >
      {children}
    </span>
  );
};
