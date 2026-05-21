'use client';

import * as React from 'react';
import { LuSmilePlus } from 'react-icons/lu';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './Menu';
import { ReactionTooltip } from './ReactionTooltip';
import { cn } from '../lib/utils';

type ReactionButtonSize = 'small' | 'icon';

interface Reaction {
  emoji: string;
  count: number;
  isActive?: boolean;
  users?: Array<{ id: string; name: string; timestamp: Date }>;
}

interface ReactionOption {
  emoji: string;
  key: string;
  label: string;
}

interface ReactionButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  emoji?: string;
  count?: number;
  className?: string;
  size?: ReactionButtonSize;
  active?: boolean;
  users?: Array<{ id: string; name: string; timestamp: Date }>;
  onPress?: React.MouseEventHandler<HTMLButtonElement>;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

interface ReactionsButtonProps {
  reactions?: Reaction[];
  reactionOptions?: readonly ReactionOption[];
  onReactionClick?: (emoji: string) => void;
  onAddReaction?: (emoji: string) => void;
  className?: string;
}

const DEFAULT_REACTION_OPTIONS: ReactionOption[] = [
  { key: 'like', label: 'Like', emoji: '👍' },
  { key: 'love', label: 'Love', emoji: '❤️' },
  { key: 'laugh', label: 'Laugh', emoji: '😂' },
  { key: 'folded_hands', label: 'Folded Hands', emoji: '🙏' },
  { key: 'celebrate', label: 'Celebrate', emoji: '🎉' },
  { key: 'fire', label: 'Fire', emoji: '🔥' },
];

const buttonClass = ({
  size,
  active,
  className,
}: {
  size: ReactionButtonSize;
  active: boolean;
  className?: string;
}) =>
  cn(
    'bg-muted hover:bg-accent focus-visible:outline-ring flex items-center justify-center gap-1 rounded-full border-0 p-1 text-xs leading-6 font-normal outline-none transition-colors duration-200 focus-visible:outline-1 focus-visible:-outline-offset-1',
    size === 'small' && 'h-8 min-w-8 px-2',
    size === 'icon' && 'h-8 w-8 p-1',
    active && 'bg-accent',
    className,
  );

export const ReactionButton = React.forwardRef<
  HTMLButtonElement,
  ReactionButtonProps
>(function ReactionButton(
  { emoji, count, active = false, size = 'small', className, users, onPress, onClick, ...props },
  ref,
) {
  if (size === 'icon') {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick ?? onPress}
        className={buttonClass({ size, active, className })}
        {...props}
      >
        <LuSmilePlus className="h-4 w-4" />
      </button>
    );
  }

  const reactionData = emoji ? [{ emoji, users: users || [] }] : [];

  return (
    <ReactionTooltip reactions={reactionData}>
      <button
        ref={ref}
        type="button"
        onClick={onClick ?? onPress}
        className={buttonClass({ size, active, className })}
        {...props}
      >
        {emoji && count !== undefined && (
          <span className="text-foreground">
            {emoji} {count}
          </span>
        )}
      </button>
    </ReactionTooltip>
  );
});

const ReactionPicker = ({
  reactionOptions = DEFAULT_REACTION_OPTIONS,
  onReactionSelect,
  existingReactions = [],
  side = 'bottom',
}: {
  reactionOptions?: readonly ReactionOption[];
  onReactionSelect: (emoji: string) => void;
  existingReactions?: Reaction[];
  side?: 'top' | 'bottom';
}) => {
  const userReactedEmojis = new Set(
    existingReactions.filter((r) => r.isActive).map((r) => r.emoji),
  );
  const availableOptions = reactionOptions.filter(
    (option) => !userReactedEmojis.has(option.emoji),
  );

  return (
    <DropdownMenuContent side={side} align="start" className="flex flex-row gap-0 p-1">
      {availableOptions.map((option) => (
        <DropdownMenuItem
          key={option.emoji}
          className="p-2"
          onClick={() => onReactionSelect(option.emoji)}
          aria-label={option.label}
        >
          <span className="text-lg">{option.emoji}</span>
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  );
};

export const ReactionsButton = ({
  reactions = [],
  reactionOptions = DEFAULT_REACTION_OPTIONS,
  onReactionClick,
  onAddReaction,
  className,
}: ReactionsButtonProps) => {
  if (reactions.length === 0) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <DropdownMenu>
          <DropdownMenuTrigger render={<ReactionButton size="icon" />} />
          <ReactionPicker
            reactionOptions={reactionOptions}
            onReactionSelect={(emoji) => onAddReaction?.(emoji)}
            existingReactions={reactions}
            side="bottom"
          />
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {reactions.map((reaction) =>
        reaction.count ? (
          <ReactionButton
            key={reaction.emoji}
            emoji={reaction.emoji}
            count={reaction.count}
            active={reaction.isActive}
            users={reaction.users}
            onClick={() => onReactionClick?.(reaction.emoji)}
          />
        ) : null,
      )}
      <DropdownMenu>
        <DropdownMenuTrigger render={<ReactionButton size="icon" />} />
        <ReactionPicker
          reactionOptions={reactionOptions}
          onReactionSelect={(emoji) => onAddReaction?.(emoji)}
          existingReactions={reactions}
          side="top"
        />
      </DropdownMenu>
    </div>
  );
};
