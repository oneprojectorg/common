import { cn } from '@op/ui/utils';
import type { ReactNode } from 'react';

export const ImageHeader = ({
  headerImage,
  avatarImage,
  headerClassName,
}: {
  headerImage?: ReactNode;
  avatarImage?: ReactNode;
  headerClassName?: string;
}) => {
  return (
    <div className="relative w-full pb-8 sm:pb-10">
      <div
        className={cn(
          'bg-offWhite relative aspect-[72/31] w-full sm:aspect-[4.6]',
          headerClassName,
        )}
      >
        {headerImage}
      </div>
      <div className="bg-offWhite absolute bottom-0 left-4 aspect-square size-16 overflow-hidden rounded-full border-2 border-white shadow-sm sm:size-[7.5rem] sm:border-4">
        {avatarImage}
      </div>
    </div>
  );
};
