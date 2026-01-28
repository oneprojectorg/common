import type { CSSProperties, ReactNode } from 'react';
import { useMemo } from 'react';

import { cn, getGradientForString } from '../../lib/utils';
import { Skeleton } from '../Skeleton';

export interface AvatarProps {
  children?: ReactNode;
  /** Name or text to use for generating initial and gradient */
  placeholder?: string;
  className?: string;
  /** Custom background color (overrides gradient) */
  backgroundColor?: string;
  /** Size variant */
  size?: 'sm' | 'md';
}

/**
 * Avatar component with support for images, initials, and custom colors.
 * Used for profile icons and presence indicators.
 */
export const Avatar = ({
  children,
  placeholder,
  className,
  backgroundColor,
  size = 'md',
}: AvatarProps) => {
  const gradientBg = useMemo(
    () => getGradientForString(placeholder || 'Common'),
    [placeholder],
  );

  const showLetterAvatar = !children;

  const sizeClasses = {
    sm: 'size-7 text-xs',
    md: 'size-8 text-sm',
  };

  const style: CSSProperties | undefined = backgroundColor
    ? { backgroundColor }
    : undefined;

  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-full bg-white text-clip shadow',
        sizeClasses[size],
        className,
      )}
    >
      {showLetterAvatar ? (
        <div
          className={cn(
            'flex size-full items-center justify-center font-medium text-white',
            !backgroundColor && gradientBg,
          )}
          style={style}
        >
          {placeholder?.slice(0, 1).toUpperCase() ?? ''}
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
