import { ReactNode, useMemo } from 'react';

import { cn, getGradientForString } from '../../lib/utils';
import { Skeleton } from '../Skeleton';

export const Avatar = ({
  children,
  placeholder,
  className,
}: {
  children?: ReactNode;
  placeholder?: string;
  className?: string;
}) => {
  const gradientBg = useMemo(
    () => getGradientForString(placeholder || 'Common'),
    [],
  );

  const showLetterAvatar = !children;

  return (
    <div
      className={cn(
        'relative flex size-8 items-center justify-center overflow-hidden rounded-full bg-white text-clip shadow',
        className,
      )}
    >
      {showLetterAvatar ? (
        <div
          className={cn(
            'flex size-full items-center justify-center bg-yellowOrange text-white',
            gradientBg,
          )}
        >
          {placeholder?.slice(0, 1) ?? ''}
        </div>
      ) : (
        children
      )}
    </div>
  );
};

export const AvatarSkeleton = ({ className }: { className?: string }) => {
  return (
    <Skeleton
      className={cn(
        'relative flex size-8 items-center justify-center overflow-hidden rounded-full text-clip',
        className,
      )}
    />
  );
};
