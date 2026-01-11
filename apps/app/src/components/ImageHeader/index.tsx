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
    <div className="pb-8 sm:pb-10 relative w-full">
      <div
        className={cn(
          'sm:aspect-[4.6] relative aspect-[72/31] w-full bg-offWhite',
          headerClassName,
        )}
      >
        {headerImage}
      </div>
      <div className="bottom-0 left-4 size-16 shadow-sm sm:size-[7.5rem] sm:border-4 absolute aspect-square overflow-hidden rounded-full border-2 border-white bg-offWhite">
        {avatarImage}
      </div>
    </div>
  );
};
