import { cn } from '@op/sense/lib/utils';
import { ReactNode } from 'react';

export const ListPageLayout = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-140 flex-col gap-5 px-4 pt-6 pb-12 sm:gap-8 sm:pt-13',
        className,
      )}
    >
      {children}
    </div>
  );
};
