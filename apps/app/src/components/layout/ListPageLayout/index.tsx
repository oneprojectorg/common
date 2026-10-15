import { cn } from '@op/sense/lib/utils';
import { ReactNode } from 'react';

/** Shared column width so switching pages in the sidebar doesn't jump. */
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
        'mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pt-6 pb-12 sm:gap-8 sm:px-8 sm:pt-13',
        className,
      )}
    >
      {children}
    </div>
  );
};
