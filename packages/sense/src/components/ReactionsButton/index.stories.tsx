import { ReactionsButton } from '@op/sense/ReactionsButton';
import type { Reaction } from '@op/sense/ReactionsButton';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

const meta: Meta<typeof ReactionsButton> = {
  title: 'Composites/ReactionsButton',
  component: ReactionsButton,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof ReactionsButton>;

const initialReactions: Reaction[] = [
  {
    emoji: '👍',
    count: 3,
    isActive: true,
    users: [
      { id: '1', name: 'Frida Kahlo', timestamp: new Date('2026-06-15') },
      { id: '2', name: 'Mark Rothko', timestamp: new Date('2026-06-14') },
      { id: '3', name: 'Sonia Delaunay', timestamp: new Date('2026-06-13') },
    ],
  },
  {
    emoji: '🎉',
    count: 1,
    users: [
      { id: '4', name: 'Lee Krasner', timestamp: new Date('2026-06-12') },
    ],
  },
];

// Stateful: click a chip to toggle your reaction, the smiley opens the
// picker. Hover a chip for the reactor tooltip.
const InteractiveDemo = () => {
  const [reactions, setReactions] = useState(initialReactions);

  const toggle = (emoji: string) => {
    setReactions((current) =>
      current
        .map((reaction) =>
          reaction.emoji === emoji
            ? {
                ...reaction,
                isActive: !reaction.isActive,
                count: reaction.count + (reaction.isActive ? -1 : 1),
              }
            : reaction,
        )
        .filter((reaction) => reaction.count > 0),
    );
  };

  const add = (emoji: string) => {
    setReactions((current) => {
      const existing = current.find((reaction) => reaction.emoji === emoji);
      if (existing) {
        return current.map((reaction) =>
          reaction.emoji === emoji
            ? { ...reaction, isActive: true, count: reaction.count + 1 }
            : reaction,
        );
      }
      return [...current, { emoji, count: 1, isActive: true }];
    });
  };

  return (
    <ReactionsButton
      reactions={reactions}
      onReactionClick={toggle}
      onAddReaction={add}
    />
  );
};

export const Default: Story = {
  render: () => <InteractiveDemo />,
};

export const Empty: Story = {
  render: () => <ReactionsButton onAddReaction={() => {}} />,
};

export const ReadOnly: Story = {
  render: () => (
    <ReactionsButton reactions={initialReactions} canReact={false} />
  ),
};
