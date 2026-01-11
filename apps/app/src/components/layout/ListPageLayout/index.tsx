import { cn } from '@op/ui/utils';
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
        'flex w-full flex-col gap-5 px-4 pb-12 pt-5 sm:min-h-[calc(100vh-3.5rem)] sm:gap-8 sm:pt-8',
        className,
      )}
    >
      {children}
    </div>
  );
};

export const ListPageLayoutHeader = ({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) => {
  return (
    <div className="flex flex-col px-0">
      <div
        className={cn(
          'sm:!text-title-lg !text-title-md text-neutral-black font-serif',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
};
