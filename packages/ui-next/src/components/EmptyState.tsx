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
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-4">
        <div className="bg-muted flex size-10 items-center justify-center gap-4 rounded-full">
          {icon ?? <LuCircleAlert />}
        </div>
        {children}
      </div>
    </div>
  );
};
