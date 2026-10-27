'use client';

import * as React from 'react';
import { LuHeart } from 'react-icons/lu';

import {
  footerButtonClasses,
  footerButtonInteractiveClasses,
} from '../../lib/footerButton';
import { cn } from '../../lib/utils';
import { AnimatedCount } from '../AnimatedCount';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

interface LikeButtonProps extends Omit<
  React.ComponentProps<'button'>,
  'children'
> {
  count?: number;
  isLiked?: boolean;
  /** Translated accessible name, including the count (e.g. "3 likes"). */
  label?: string;
  /** Translated hover content naming recent likers. Omit for no tooltip. */
  tooltip?: React.ReactNode;
  /** False renders a read-only count that stays focusable for the tooltip. */
  canLike?: boolean;
}

/** The like half of a post's footer — a heart and a count beside `CommentButton`. */
// fallow-ignore-next-line complexity
function LikeButton({
  count = 0,
  isLiked = false,
  label,
  tooltip,
  canLike = true,
  className,
  dir = 'auto',
  onClick,
  ...props
}: LikeButtonProps) {
  const button = (
    <button
      type="button"
      data-slot="like-button"
      dir={dir}
      aria-label={label ?? `${count} likes`}
      aria-pressed={canLike ? isLiked : undefined}
      // Not native disabled: keeps tab order so the tooltip stays reachable.
      aria-disabled={canLike ? undefined : true}
      onClick={canLike ? onClick : undefined}
      className={cn(
        footerButtonClasses,
        canLike && footerButtonInteractiveClasses,
        className,
      )}
      {...props}
    >
      <LuHeart
        className={cn(
          'size-5 shrink-0',
          isLiked && 'fill-current text-primary',
        )}
      />
      <span aria-live="polite">
        <AnimatedCount value={count ?? 0} />
      </span>
    </button>
  );

  return (
    <Tooltip disabled={!tooltip}>
      <TooltipTrigger render={button} />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export { LikeButton };
