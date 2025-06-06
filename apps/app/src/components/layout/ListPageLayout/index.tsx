import { cn } from '@op/ui/utils';
import { ReactNode } from 'react';

export const ListPageLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex w-full flex-col gap-5 px-4 pb-12 pt-8 sm:min-h-[calc(100vh-3.5rem)] sm:gap-8">
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
    <div className="flex flex-col gap-4 px-0">
      <div
        className={cn(
          'font-serif text-title-lg text-neutral-black sm:text-title-lg',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
};
