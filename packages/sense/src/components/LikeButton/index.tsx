'use client';

import * as React from 'react';
import { LuThumbsUp } from 'react-icons/lu';

import { cn } from '../../lib/utils';
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
// The branching is prop defaults plus the liked/read-only styling forks — flat,
// not nested. Splitting it further would trade a readable component for
// indirection, and sense has no headless test runner to score coverage against
// (see packages/sense/README.md).
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
  const button = (
    <button
      type="button"
      data-slot="like-button"
      aria-pressed={canLike ? isLiked : undefined}
      // Read-only buttons stay enabled (aria-disabled, no press affordances) so
      // they keep tab order and the liker tooltip stays reachable — native
      // disabled would suppress both.
      aria-disabled={canLike ? undefined : true}
      onClick={canLike ? onClick : undefined}
      className={cn(
        'flex h-8 items-center justify-center gap-1 rounded-md bg-muted px-2 py-1 text-sm text-nowrap text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        canLike
          ? 'cursor-pointer hover:bg-gray-100 hover:text-foreground active:bg-gray-200 active:text-foreground'
          : 'cursor-default',
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
