'use client';

import { SmilePlus } from 'lucide-react';
import { Button as RACButton } from 'react-aria-components';
import { tv } from 'tailwind-variants';
import type { VariantProps } from 'tailwind-variants';

import { MenuTrigger } from './Menu';
import { Popover } from './Popover';

const reactionButtonStyle = tv({
  base: 'flex items-center justify-center gap-1 rounded-full border-0 bg-neutral-offWhite p-1 text-xs font-normal leading-6 outline-none transition-colors duration-200 hover:bg-neutral-gray1 focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-data-blue pressed:bg-neutral-gray2',
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

const reactionPickerStyle = tv({
  base: 'grid grid-cols-4 gap-2 p-2',
});

const reactionPickerItemStyle = tv({
  base: 'flex h-8 w-8 items-center justify-center rounded-full border-0 bg-transparent text-lg outline-none transition-colors duration-200 hover:bg-neutral-gray1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 pressed:bg-neutral-gray2',
});

type ReactionButtonVariants = VariantProps<typeof reactionButtonStyle>;

interface Reaction {
  emoji: string;
  count: number;
  isActive?: boolean;
}

interface ReactionOption {
  emoji: string;
  key: string;
  label: string;
}

interface ReactionButtonProps
  extends Omit<React.ComponentProps<typeof RACButton>, 'children'>,
    ReactionButtonVariants {
  emoji?: string;
  count?: number;
  className?: string;
}

interface ReactionsButtonProps {
  reactions?: Reaction[];
  reactionOptions?: readonly ReactionOption[];
  onReactionClick?: (emoji: string) => void;
  onAddReaction?: (emoji: string) => void;
  className?: string;
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
  ...props
}: ReactionButtonProps) => {
  if (size === 'icon') {
    return (
      <RACButton
        {...props}
        className={reactionButtonStyle({ size, active, className })}
      >
        <SmilePlus className="h-4 w-4" />
      </RACButton>
    );
  }

  return (
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
  );
};

const ReactionPicker = ({
  reactionOptions = DEFAULT_REACTION_OPTIONS,
  onReactionSelect,
}: {
  reactionOptions?: readonly ReactionOption[];
  onReactionSelect: (emoji: string) => void;
}) => {
  return (
    <div className={reactionPickerStyle()}>
      {reactionOptions.map((option) => (
        <RACButton
          key={option.emoji}
          className={reactionPickerItemStyle()}
          onPress={() => onReactionSelect(option.emoji)}
        >
          {option.emoji}
        </RACButton>
      ))}
    </div>
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
      <div className={reactionGroupStyle({ className })}>
        <MenuTrigger>
          <ReactionButton size="icon" />
          <Popover placement="bottom left" className="border bg-white">
            <ReactionPicker
              reactionOptions={reactionOptions}
              onReactionSelect={(emoji) => onAddReaction?.(emoji)}
            />
          </Popover>
        </MenuTrigger>
      </div>
    );
  }

  return (
    <div className={reactionGroupStyle({ className })}>
      {reactions.map((reaction) => (
        <ReactionButton
          key={reaction.emoji}
          emoji={reaction.emoji}
          count={reaction.count}
          active={reaction.isActive}
          onPress={() => onReactionClick?.(reaction.emoji)}
        />
      ))}
      <MenuTrigger>
        <ReactionButton size="icon" />
        <Popover placement="top left">
          <ReactionPicker
            reactionOptions={reactionOptions}
            onReactionSelect={(emoji) => onAddReaction?.(emoji)}
          />
        </Popover>
      </MenuTrigger>
    </div>
  );
};
