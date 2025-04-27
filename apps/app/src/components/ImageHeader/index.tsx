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
    <div className="relative w-full pb-14">
      <div
        className={cn(
          'relative aspect-[4.6] w-full bg-offWhite',
          headerClassName,
        )}
      >
        {headerImage}
      </div>
      <div className="absolute bottom-0 left-4 aspect-square size-28 overflow-hidden rounded-full border-4 border-white bg-offWhite shadow">
        {avatarImage}
      </div>
    </div>
  );
};
