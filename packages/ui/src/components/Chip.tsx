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
        'items-center rounded-sm bg-neutral-gray1 p-1 text-xs text-neutral-charcoal',
        className,
      )}
    >
      {children}
    </span>
  );
};
