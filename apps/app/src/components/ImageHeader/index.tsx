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
          'relative aspect-[72/31] w-full bg-offWhite sm:aspect-[4.6]',
          headerClassName,
        )}
      >
        {headerImage}
      </div>
      <div className="absolute start-4 bottom-0 aspect-square size-16 overflow-hidden rounded-full border-2 border-white bg-offWhite shadow-sm sm:size-[7.5rem] sm:border-4">
        {avatarImage}
      </div>
    </div>
  );
};
