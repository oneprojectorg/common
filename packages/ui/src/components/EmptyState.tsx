import type { ReactNode } from 'react';
import { LuCircleAlert } from 'react-icons/lu';

import { cn } from '@/lib/utils';

export const EmptyState = ({
  icon,
  children,
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        'flex min-h-40 w-full flex-col items-center justify-center py-6',
        className,
      )}
    >
      <div className="flex flex-col items-center justify-center gap-4 text-neutral-gray4">
        <div className="flex size-10 items-center justify-center gap-4 rounded-full bg-neutral-gray1">
          {icon ?? <LuCircleAlert />}
        </div>
        {children}
      </div>
    </div>
  );
};
