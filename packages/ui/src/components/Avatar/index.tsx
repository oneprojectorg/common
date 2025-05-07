import { ReactNode } from 'react';

import { cn } from '../../lib/utils';

export const Avatar = ({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        'relative flex size-8 items-center justify-center overflow-hidden text-clip rounded-full border bg-white shadow',
        className,
      )}
    >
      {children}
    </div>
  );
};
