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
        'p-1 items-center rounded-sm bg-neutral-gray1 text-xs text-neutral-charcoal',
        className,
      )}
    >
      {children}
    </span>
  );
};
