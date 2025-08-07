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

// Helper functions for better code organization
const processReactionUsers = (reactions: ReactionData[]) => {
  return reactions
    .filter(
      (reaction) => reaction?.emoji?.trim() && Array.isArray(reaction.users),
    )
    .flatMap((reaction) =>
      reaction.users.map((user) => ({ ...user, emoji: reaction.emoji })),
    )
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

const formatTooltipContent = (
  allUsers: Array<ReactionUser & { emoji: string }>,
  maxDisplayUsers = 2,
) => {
  if (allUsers.length === 0) {
    return null;
  }

  const latestUsers = allUsers.slice(0, maxDisplayUsers);
  const remainingCount = Math.max(0, allUsers.length - maxDisplayUsers);

  const emojis = [...new Set(allUsers.map((u) => u.emoji))].join(' ');
  const userNames = latestUsers.map((u) => u.name).join(', ');

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

  return (
    <span className="text-sm">
      {emojis} {userNames}
    </span>
  );
};

const ReactionTooltip = ({
  reactions,
  children,
  ...props
}: ReactionTooltipProps) => {
  const tooltipContent = useMemo(() => {
    if (!reactions?.length) {
      return null;
    }

    const processedUsers = processReactionUsers(reactions);
    return formatTooltipContent(processedUsers);
  }, [reactions]);

  if (!tooltipContent) {
    return <>{children}</>;
  }

  return (
    <TooltipTrigger>
      {children}
      <Tooltip {...props}>{tooltipContent}</Tooltip>
    </TooltipTrigger>
  );
};

export { ReactionTooltip };
