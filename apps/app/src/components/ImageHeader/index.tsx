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
    <div className="relative w-full pb-8 sm:pb-14">
      <div
        className={cn(
          'relative aspect-[72/31] w-full bg-offWhite sm:aspect-[4.6]',
          headerClassName,
        )}
      >
        {headerImage}
      </div>
      <div className="absolute bottom-0 left-4 aspect-square size-16 overflow-hidden rounded-full border-2 border-white bg-offWhite shadow sm:size-28 sm:border-4">
        {avatarImage}
      </div>
    </div>
  );
};
