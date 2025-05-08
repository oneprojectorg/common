import type { ReactNode } from 'react';

import { cn } from '../lib/utils';

export const Surface = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        'bg-neutral-white rounded border border-neutral-gray1 shadow-light',
        className,
      )}
    >
      {children}
    </div>
  );
};
