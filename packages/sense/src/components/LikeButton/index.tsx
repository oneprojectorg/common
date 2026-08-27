'use client';

import * as React from 'react';
import { LuThumbsUp } from 'react-icons/lu';

import { cn } from '../../lib/utils';
import {
  footerButtonClasses,
  footerButtonInteractiveClasses,
} from '../CommentButton';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

interface LikeUser {
  id: string;
  name: string;
  timestamp: Date;
}

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
  /** Likers named in the hover tooltip, newest first. */
  users?: LikeUser[];
  /**
   * When false the button renders as a read-only count: no press affordances,
   * but still focusable so the tooltip stays reachable by keyboard.
   */
  canLike?: boolean;
}

/**
 * The like half of a post's footer, sized and styled to sit beside
 * `CommentButton`. Pass `users` to name recent likers on hover.
 */
// What's left after folding the read-only fork into `pressProps` and moving the
// shared chrome into `footerButtonClasses` is three prop defaults, the liked
// styling on two elements, and the tooltip bail — flat, and sense has no
// headless runner to score coverage against (see packages/sense/README.md).
// fallow-ignore-next-line complexity
function LikeButton({
  count = 0,
  isLiked = false,
  label,
  users,
  canLike = true,
  className,
  onClick,
  ...props
}: LikeButtonProps) {
  // Read-only buttons stay enabled (aria-disabled, no press affordances) so
  // they keep tab order and the liker tooltip stays reachable — native disabled
  // would suppress both.
  const pressProps: React.ComponentProps<'button'> = canLike
    ? {
        'aria-pressed': isLiked,
        onClick,
        className: footerButtonInteractiveClasses,
      }
    : { 'aria-disabled': true, className: 'cursor-default' };

  const button = (
    <button
      type="button"
      data-slot="like-button"
      {...pressProps}
      className={cn(
        footerButtonClasses,
        pressProps.className,
        isLiked && 'bg-gray-100 text-foreground',
        className,
      )}
      {...props}
    >
      <LuThumbsUp
        className={cn('size-4 shrink-0', isLiked && 'fill-current')}
      />
      <span>{label ?? `${count} likes`}</span>
    </button>
  );

  const tooltipContent = formatLikeTooltip(users);

  if (!tooltipContent) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent>{tooltipContent}</TooltipContent>
    </Tooltip>
  );
}

// Newest two likers by name, then "+ N others".
function formatLikeTooltip(users: LikeUser[] = []): React.ReactNode {
  if (users.length === 0) {
    return null;
  }

  const sorted = users
    .slice()
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const latest = sorted.slice(0, 2);
  const remaining = sorted.length - latest.length;
  const names = latest.map((user) => user.name).join(', ');

  if (remaining > 0) {
    const othersLabel = `${remaining} other${remaining === 1 ? '' : 's'}`;
    return (
      <span className="text-sm">
        {names}, and{' '}
        <span aria-label={`${othersLabel} additional likes`}>
          {othersLabel}
        </span>
      </span>
    );
  }

  return <span className="text-sm">{names}</span>;
}

export { LikeButton, type LikeUser };
