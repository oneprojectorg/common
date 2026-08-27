'use client';

import * as React from 'react';
import { LuThumbsUp } from 'react-icons/lu';

import {
  footerButtonClasses,
  footerButtonInteractiveClasses,
} from '../../lib/footerButton';
import { cn } from '../../lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

interface LikeButtonProps extends Omit<
  React.ComponentProps<'button'>,
  'children'
> {
  count?: number;
  /** Renders the button as pressed — the viewer has already liked. */
  isLiked?: boolean;
  /**
   * Fully-formatted, translated label (e.g. "3 likes"). Consumers should pass
   * an i18n-translated string since this package is locale-agnostic. Falls back
   * to an English default when omitted.
   */
  label?: string;
  /**
   * Already-translated hover content naming recent likers. Composed by the
   * caller — naming and joining people is locale-specific and this package has
   * no translations. Omit it and no tooltip renders.
   */
  tooltip?: React.ReactNode;
  /**
   * When false the button renders as a read-only count: no press affordances,
   * but still focusable so the tooltip stays reachable by keyboard.
   */
  canLike?: boolean;
}

/**
 * The like half of a post's footer, sized and styled to sit beside
 * `CommentButton`. Pass `tooltip` to name recent likers on hover.
 */
// What's left is four prop defaults, the read-only fork, the liked styling on
// two elements, and the tooltip bail — flat, and sense has no headless runner to
// score coverage against (see packages/sense/README.md).
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
      aria-pressed={canLike ? isLiked : undefined}
      // Read-only buttons stay enabled (aria-disabled, no press affordances) so
      // they keep tab order and the liker tooltip stays reachable — native
      // disabled would suppress both.
      aria-disabled={canLike ? undefined : true}
      onClick={canLike ? onClick : undefined}
      className={cn(
        footerButtonClasses,
        canLike ? footerButtonInteractiveClasses : 'cursor-default',
        isLiked && 'bg-accent text-accent-foreground',
        className,
      )}
      {...props}
    >
      <LuThumbsUp
        className={cn('size-4 shrink-0', isLiked && 'fill-current')}
      />
      {/* The count changes without a navigation when the viewer toggles. */}
      <span aria-live="polite">{label ?? `${count} likes`}</span>
    </button>
  );

  if (!tooltip) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export { LikeButton };
