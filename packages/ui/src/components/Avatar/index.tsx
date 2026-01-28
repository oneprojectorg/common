import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { cn, getGradientForString } from '../../lib/utils';
import { Skeleton } from '../Skeleton';

export interface AvatarProps {
  children?: ReactNode;
  /** Name or text to use for generating initial and gradient */
  placeholder?: string;
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Show full placeholder text instead of just the first character */
  showFullText?: boolean;
}

/**
 * Avatar component with support for images, initials, and gradient backgrounds.
 * Gradient is deterministically derived from placeholder text.
 */
export const Avatar = ({
  children,
  placeholder,
  className,
  size = 'md',
  showFullText = false,
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
            gradientBg,
          )}
        >
          {showFullText
            ? placeholder
            : (placeholder?.slice(0, 1).toUpperCase() ?? '')}
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
