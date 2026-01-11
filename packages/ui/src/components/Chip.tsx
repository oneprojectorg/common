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
        'bg-neutral-gray1 text-neutral-charcoal items-center rounded-sm p-1 text-xs',
        className,
      )}
    >
      {children}
    </span>
  );
};
