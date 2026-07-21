'use client';

import * as React from 'react';
import { LuSmilePlus } from 'react-icons/lu';

import { cn } from '../../lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

interface ReactionUser {
  id: string;
  name: string;
  timestamp: Date;
}

interface Reaction {
  emoji: string;
  count: number;
  isActive?: boolean;
  /** Reactors, newest first in the hover tooltip. */
  users?: ReactionUser[];
}

interface ReactionOption {
  emoji: string;
  key: string;
  label: string;
}

interface ReactionsButtonProps {
  reactions?: Reaction[];
  reactionOptions?: readonly ReactionOption[];
  onReactionClick?: (emoji: string) => void;
  onAddReaction?: (emoji: string) => void;
  className?: string;
  /** When false, reactions render read-only and the add-reaction picker is hidden. */
  canReact?: boolean;
}

const DEFAULT_REACTION_OPTIONS: ReactionOption[] = [
  { key: 'like', label: 'Like', emoji: '👍' },
  { key: 'love', label: 'Love', emoji: '❤️' },
  { key: 'laugh', label: 'Laugh', emoji: '😂' },
  { key: 'folded_hands', label: 'Folded Hands', emoji: '🙏' },
  { key: 'celebrate', label: 'Celebrate', emoji: '🎉' },
  { key: 'fire', label: 'Fire', emoji: '🔥' },
];

function ReactionsButton({
  reactions = [],
  reactionOptions = DEFAULT_REACTION_OPTIONS,
  onReactionClick,
  onAddReaction,
  className,
  canReact = true,
}: ReactionsButtonProps) {
  if (reactions.length === 0 && !canReact) {
    return null;
  }

  return (
    <div
      data-slot="reactions"
      className={cn('flex items-center gap-1', className)}
    >
      {reactions.map((reaction) =>
        reaction.count ? (
          <ReactionChip
            key={reaction.emoji}
            reaction={reaction}
            onClick={
              canReact ? () => onReactionClick?.(reaction.emoji) : undefined
            }
          />
        ) : null,
      )}
      {canReact ? (
        <ReactionPicker
          reactionOptions={reactionOptions}
          existingReactions={reactions}
          onAddReaction={onAddReaction}
        />
      ) : null}
    </div>
  );
}

const chipClasses =
  'flex h-8 min-w-8 items-center justify-center gap-1 rounded-full bg-muted px-2 text-xs leading-6 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring/50';

const chipInteractiveClasses =
  'cursor-pointer hover:bg-gray-100 active:bg-gray-200';

function ReactionChip({
  reaction,
  onClick,
}: {
  reaction: Reaction;
  onClick?: () => void;
}) {
  const tooltipContent = formatReactionTooltip(reaction);

  // Read-only chips stay enabled (aria-disabled, no press affordances) so
  // they keep tab order and the reactor tooltip stays reachable — native
  // disabled would suppress both.
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={onClick ? undefined : true}
      className={cn(
        chipClasses,
        onClick ? chipInteractiveClasses : 'cursor-default',
        reaction.isActive && 'bg-gray-100',
      )}
    >
      <span className="text-foreground">
        {reaction.emoji} {reaction.count}
      </span>
    </button>
  );

  if (!tooltipContent) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent className="sense">{tooltipContent}</TooltipContent>
    </Tooltip>
  );
}

function ReactionPicker({
  reactionOptions,
  existingReactions,
  onAddReaction,
}: {
  reactionOptions: readonly ReactionOption[];
  existingReactions: Reaction[];
  onAddReaction?: (emoji: string) => void;
}) {
  const [open, setOpen] = React.useState(false);

  // Hide emojis the current user has already reacted with.
  const userReactedEmojis = new Set(
    existingReactions.filter((r) => r.isActive).map((r) => r.emoji),
  );
  const availableOptions = reactionOptions.filter(
    (option) => !userReactedEmojis.has(option.emoji),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Add reaction"
            className={cn(chipClasses, chipInteractiveClasses, 'w-8 p-1')}
          />
        }
      >
        <LuSmilePlus className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="sense w-auto p-1" sideOffset={4}>
        {/* Plain buttons in a popover — not role=menu, which would promise
            arrow-key navigation the div doesn't implement. */}
        <div className="flex" role="group" aria-label="Reactions">
          {availableOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-label={option.label}
              onClick={() => {
                onAddReaction?.(option.emoji);
                setOpen(false);
              }}
              className="cursor-pointer rounded-md p-2 outline-none hover:bg-muted focus-visible:bg-muted"
            >
              <span className="flex size-5 items-center justify-center text-lg leading-none">
                {option.emoji}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Newest two reactors by name, then "+ N others" — the ReactionTooltip
// behavior, absorbed here.
function formatReactionTooltip(reaction: Reaction): React.ReactNode {
  const users = (reaction.users ?? []).slice().sort((a, b) => {
    const aTime = new Date(a.timestamp).getTime() || 0;
    const bTime = new Date(b.timestamp).getTime() || 0;
    return bTime - aTime;
  });

  if (users.length === 0) {
    return null;
  }

  const latest = users.slice(0, 2);
  const remaining = users.length - latest.length;
  const names = latest.map((user) => user.name).join(', ');

  if (remaining > 0) {
    const othersLabel = `${remaining} other${remaining === 1 ? '' : 's'}`;
    return (
      <span className="text-sm">
        {reaction.emoji} {names}, and{' '}
        <span aria-label={`${othersLabel} additional reactions`}>
          {othersLabel}
        </span>
      </span>
    );
  }

  return (
    <span className="text-sm">
      {reaction.emoji} {names}
    </span>
  );
}

export {
  ReactionsButton,
  type Reaction,
  type ReactionOption,
  type ReactionUser,
};
