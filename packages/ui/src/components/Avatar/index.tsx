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

  return (
    <div
      className={cn(
        'relative flex size-8 items-center justify-center overflow-hidden text-clip rounded-full bg-white shadow outline outline-neutral-gray1',
        className,
      )}
    >
      {children === null ? (
        <div
          className={cn(
            'bg-yellowOrange flex size-full items-center justify-center text-white',
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
        'relative flex size-8 items-center justify-center overflow-hidden text-clip rounded-full bg-white shadow outline outline-neutral-gray1',
        className,
      )}
    />
  );
};
