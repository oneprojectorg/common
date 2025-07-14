'use client';

import { SmilePlus } from 'lucide-react';
import { Button as RACButton } from 'react-aria-components';
import { tv } from 'tailwind-variants';
import type { VariantProps } from 'tailwind-variants';

const reactionButtonStyle = tv({
  base: 'flex items-center justify-center gap-1 rounded-full border-0 bg-neutral-offWhite p-1 text-xs font-normal leading-6 outline-none transition-colors duration-200 hover:bg-neutral-gray1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 pressed:bg-neutral-gray2',
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
  onReactionClick?: (emoji: string) => void;
  onAddReaction?: () => void;
  className?: string;
}

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

export const ReactionsButton = ({
  reactions = [],
  onReactionClick,
  onAddReaction,
  className,
}: ReactionsButtonProps) => {
  if (reactions.length === 0) {
    return (
      <div className={reactionGroupStyle({ className })}>
        <ReactionButton size="icon" onPress={onAddReaction} />
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
      <ReactionButton size="icon" onPress={onAddReaction} />
    </div>
  );
};