'use client';

import { Button as RACButton } from 'react-aria-components';
import { LuSmilePlus } from 'react-icons/lu';
import { tv } from 'tailwind-variants';
import type { VariantProps } from 'tailwind-variants';

import { Menu, MenuItem, MenuTrigger } from './Menu';
import { ReactionTooltip } from './ReactionTooltip';

const reactionButtonStyle = tv({
  base: 'flex items-center justify-center gap-1 rounded-full border-0 bg-neutral-offWhite p-1 text-xs leading-6 font-normal outline-hidden transition-colors duration-200 hover:bg-neutral-gray1 focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-data-blue pressed:bg-neutral-gray2',
  variants: {
    size: {
      small: 'h-8 min-w-8 px-2',
      icon: 'h-8 w-8 p-1',
    },
    active: {
      true: 'bg-neutral-gray1',
      false: '',
    },
  },
  defaultVariants: {
    size: 'small',
    active: false,
  },
});

const reactionGroupStyle = tv({
  base: 'flex items-center gap-1',
});

type ReactionButtonVariants = VariantProps<typeof reactionButtonStyle>;

interface Reaction {
  emoji: string;
  count: number;
  isActive?: boolean;
  users?: Array<{ id: string; name: string; timestamp: Date }>; // Added for tooltip
}

interface ReactionOption {
  emoji: string;
  key: string;
  label: string;
}

interface ReactionButtonProps
  extends
    Omit<React.ComponentProps<typeof RACButton>, 'children'>,
    ReactionButtonVariants {
  emoji?: string;
  count?: number;
  className?: string;
  users?: Array<{ id: string; name: string; timestamp: Date }>; // Added for tooltip
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

// We'll import the actual reaction options from @op/types in the consumer component
const DEFAULT_REACTION_OPTIONS: ReactionOption[] = [
  { key: 'like', label: 'Like', emoji: '👍' },
  { key: 'love', label: 'Love', emoji: '❤️' },
  { key: 'laugh', label: 'Laugh', emoji: '😂' },
  { key: 'folded_hands', label: 'Folded Hands', emoji: '🙏' },
  { key: 'celebrate', label: 'Celebrate', emoji: '🎉' },
  { key: 'fire', label: 'Fire', emoji: '🔥' },
];

export const ReactionButton = ({
  emoji,
  count,
  active,
  size = 'small',
  className,
  users,
  ...props
}: ReactionButtonProps) => {
  if (size === 'icon') {
    return (
      <RACButton
        {...props}
        className={reactionButtonStyle({ size, active, className })}
      >
        <LuSmilePlus className="h-4 w-4" />
      </RACButton>
    );
  }

  const reactionData = emoji
    ? [{ emoji, users: users || [], totalCount: count }]
    : [];

  return (
    <ReactionTooltip reactions={reactionData}>
      <RACButton
        {...props}
        className={reactionButtonStyle({ size, active, className })}
      >
        {emoji && count !== undefined && (
          <span className="text-black">
            {emoji} {count}
          </span>
        )}
      </RACButton>
    </ReactionTooltip>
  );
};

const ReactionPicker = ({
  reactionOptions = DEFAULT_REACTION_OPTIONS,
  onReactionSelect,
  existingReactions = [],
}: {
  reactionOptions?: readonly ReactionOption[];
  onReactionSelect: (emoji: string) => void;
  existingReactions?: Reaction[];
}) => {
  // Filter out emojis that the current user has already reacted with (isActive = true)
  const userReactedEmojis = new Set(
    existingReactions.filter((r) => r.isActive).map((r) => r.emoji),
  );
  const availableOptions = reactionOptions.filter(
    (option) => !userReactedEmojis.has(option.emoji),
  );

  return (
    <Menu className="flex" onAction={(key) => onReactionSelect(key as string)}>
      {availableOptions.map((option) => (
        <MenuItem
          unstyled
          className="p-2"
          key={option.emoji}
          id={option.emoji}
          textValue={option.label}
        >
          <span className="flex size-5 items-center justify-center text-lg leading-none">
            {option.emoji}
          </span>
        </MenuItem>
      ))}
    </Menu>
  );
};

const AddReactionMenu = ({
  reactionOptions,
  onAddReaction,
  existingReactions,
}: {
  reactionOptions?: readonly ReactionOption[];
  onAddReaction?: (emoji: string) => void;
  existingReactions: Reaction[];
}) => (
  <MenuTrigger>
    <ReactionButton size="icon" aria-label="Add reaction" />
    <ReactionPicker
      reactionOptions={reactionOptions}
      onReactionSelect={(emoji) => onAddReaction?.(emoji)}
      existingReactions={existingReactions}
    />
  </MenuTrigger>
);

export const ReactionsButton = ({
  reactions = [],
  reactionOptions = DEFAULT_REACTION_OPTIONS,
  onReactionClick,
  onAddReaction,
  className,
  canReact = true,
}: ReactionsButtonProps) => {
  if (reactions.length === 0) {
    if (!canReact) {
      return null;
    }

    return (
      <div className={reactionGroupStyle({ className })}>
        <AddReactionMenu
          reactionOptions={reactionOptions}
          onAddReaction={onAddReaction}
          existingReactions={reactions}
        />
      </div>
    );
  }

  return (
    <div className={reactionGroupStyle({ className })}>
      {reactions.map((reaction) =>
        reaction.count ? (
          <ReactionButton
            key={reaction.emoji}
            emoji={reaction.emoji}
            count={reaction.count}
            active={reaction.isActive}
            users={reaction.users}
            onPress={
              canReact ? () => onReactionClick?.(reaction.emoji) : undefined
            }
          />
        ) : null,
      )}
      {canReact ? (
        <AddReactionMenu
          reactionOptions={reactionOptions}
          onAddReaction={onAddReaction}
          existingReactions={reactions}
        />
      ) : null}
    </div>
  );
};
