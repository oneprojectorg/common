'use client';

import { useMemo } from 'react';

import { Tooltip, type TooltipProps, TooltipTrigger } from './Tooltip';

export interface ReactionUser {
  id: string;
  name: string;
  timestamp: Date;
}

export interface ReactionData {
  emoji: string;
  users: ReactionUser[];
}

export interface ReactionTooltipProps extends Omit<TooltipProps, 'children'> {
  reactions?: ReactionData[];
  children: React.ReactNode;
}

const ReactionTooltip = ({
  reactions,
  children,
  ...props
}: ReactionTooltipProps) => {
  const tooltipContent = useMemo(() => {
    if (!reactions?.length) {
      return null;
    }

    // Validate and collect all users with timestamps
    const allUsers = reactions
      .filter((r) => r?.emoji?.trim() && Array.isArray(r.users))
      .flatMap((reaction) =>
        reaction.users
          .filter(
            (user) =>
              user?.id?.trim() &&
              user?.name?.trim() &&
              user?.timestamp instanceof Date &&
              !isNaN(user.timestamp.getTime()),
          )
          .map((user) => ({ ...user, emoji: reaction.emoji })),
      );

    if (allUsers.length === 0) {
      return null;
    }

    // Sort by timestamp (most recent first) and get latest 2
    allUsers.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const latestUsers = allUsers.slice(0, 2);
    const remainingCount = allUsers.length - 2;

    // Build display text
    const emojis = [...new Set(allUsers.map((u) => u.emoji))].join(' ');
    const userNames = latestUsers.map((u) => u.name).join(', ');
    const othersText =
      remainingCount > 0
        ? `, and ${remainingCount} other${remainingCount === 1 ? '' : 's'}`
        : '';

    const fullText = `${emojis} ${userNames}${othersText}`;

    if (remainingCount > 0) {
      const othersLabel = `${remainingCount} other${remainingCount === 1 ? '' : 's'}`;
      return (
        <span className="text-sm">
          {emojis} {userNames}, and{' '}
          <span aria-label={`${othersLabel} additional reactions`}>
            {othersLabel}
          </span>
        </span>
      );
    }

    return <span className="text-sm">{fullText}</span>;
  }, [reactions]);

  if (!tooltipContent) {
    return children;
  }

  return (
    <TooltipTrigger>
      {children}
      <Tooltip {...props}>{tooltipContent}</Tooltip>
    </TooltipTrigger>
  );
};

export { ReactionTooltip };
