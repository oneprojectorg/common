// Compatibility wrapper for @op/ui's Avatar. Backed by shadcn's base-nova
// Avatar primitive (Root + Image + Fallback). Preserves the legacy
// single-component API: pass `placeholder` and an optional image as
// children; missing children render a gradient-tinted initial fallback.
//
// For new code, prefer composing shadcn primitives directly:
//   <Avatar><AvatarImage src="…" /><AvatarFallback>NM</AvatarFallback></Avatar>

import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { cn, getGradientForString } from '../lib/utils';
import {
  Avatar as ShadcnAvatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from './ui/avatar';
import { Skeleton } from './ui/skeleton';

const sizeMap = {
  sm: 'sm',
  md: 'default',
  lg: 'lg',
} as const;

const fallbackTextSize = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-sm',
};

export interface AvatarProps {
  children?: ReactNode;
  /** Used for initial generation and deterministic gradient. */
  placeholder?: string;
  className?: string;
  /** Legacy size names (sm/md/lg) — mapped to shadcn's sm/default/lg. */
  size?: keyof typeof sizeMap;
  /** Render the full `placeholder` string instead of the first character. */
  showFullText?: boolean;
}

export function Avatar({
  children,
  placeholder,
  className,
  size = 'md',
  showFullText = false,
}: AvatarProps) {
  const gradientBg = useMemo(
    () => getGradientForString(placeholder || 'Common'),
    [placeholder],
  );

  return (
    <ShadcnAvatar size={sizeMap[size]} className={className}>
      {children ?? (
        <AvatarFallback
          className={cn(
            'border-0 font-medium text-white',
            fallbackTextSize[size],
            gradientBg,
          )}
        >
          {showFullText
            ? placeholder
            : (placeholder?.slice(0, 1).toUpperCase() ?? '')}
        </AvatarFallback>
      )}
    </ShadcnAvatar>
  );
}

export function AvatarSkeleton({
  size = 'md',
  className,
}: {
  size?: keyof typeof sizeMap;
  className?: string;
}) {
  const sizeClass =
    size === 'sm' ? 'size-6' : size === 'lg' ? 'size-10' : 'size-8';
  return <Skeleton className={cn('rounded-full', sizeClass, className)} />;
}

// Re-export shadcn primitives for new-code composition.
export {
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
};
