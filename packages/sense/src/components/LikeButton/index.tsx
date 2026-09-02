'use client';

import * as React from 'react';
import { LuHeart } from 'react-icons/lu';

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
  /** Fills the heart — the viewer has already liked. */
  isLiked?: boolean;
  /**
   * Translated accessible name (e.g. "3 likes"). Only the count is drawn, so
   * this is what a screen reader announces; it should contain the count so the
   * name still matches the visible text. Consumers pass an i18n-translated
   * string since this package is locale-agnostic.
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
 * The like half of a post's footer — a heart and a count, sized to sit beside
 * `CommentButton`. Pass `tooltip` to name recent likers on hover.
 */
// What's left is five prop defaults, the read-only fork, the filled-heart
// styling, and the tooltip bail — flat, and sense has no headless runner to
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
      // Only the count is drawn, so the number alone would be the whole
      // accessible name. The label carries it plus the noun.
      aria-label={label ?? `${count} likes`}
      aria-pressed={canLike ? isLiked : undefined}
      // Read-only buttons stay enabled (aria-disabled, no press affordances) so
      // they keep tab order and the liker tooltip stays reachable — native
      // disabled would suppress both.
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
      {/* The count changes without a navigation when anyone likes the post. */}
      <span aria-live="polite">{count}</span>
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
