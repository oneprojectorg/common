import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { ReactionsButton } from '@/components/ReactionsButton';

const meta: Meta<typeof ReactionsButton> = {
  title: 'shadcn/ReactionsButton',
  component: ReactionsButton,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ReactionsButton>;

const USERS = [
  { id: 'a', name: 'Alex', timestamp: new Date() },
  { id: 'b', name: 'Bea', timestamp: new Date() },
  { id: 'c', name: 'Cy', timestamp: new Date() },
];

export const Empty: Story = {
  render: () => (
    <ReactionsButton onAddReaction={(e) => console.log('add', e)} />
  ),
};

export const WithReactions: Story = {
  render: () => {
    const [reactions, setReactions] = useState([
      { emoji: '👍', count: 3, isActive: true, users: USERS },
      { emoji: '🎉', count: 1, users: [USERS[0]!] },
    ]);
    return (
      <ReactionsButton
        reactions={reactions}
        onReactionClick={(emoji) => console.log('click', emoji)}
        onAddReaction={(emoji) =>
          setReactions((r) => [...r, { emoji, count: 1, users: [] }])
        }
      />
    );
  },
};
