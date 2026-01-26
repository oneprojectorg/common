import type { ReactNode } from 'react';
import { LuCircleAlert } from 'react-icons/lu';

export const EmptyState = ({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) => {
  return (
    <div className="flex min-h-40 w-full flex-col items-center justify-center py-6">
      <div className="flex flex-col items-center justify-center gap-4 text-neutral-gray4">
        <div className="flex size-10 items-center justify-center gap-4 rounded-full bg-neutral-gray1">
          {icon ?? <LuCircleAlert />}
        </div>
        {children}
      </div>
    </div>
  );
};
