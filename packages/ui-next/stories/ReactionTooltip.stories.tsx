import type { Meta, StoryObj } from '@storybook/react-vite';

import { ReactionTooltip } from '@/components/ReactionTooltip';

const meta: Meta<typeof ReactionTooltip> = {
  title: 'shadcn/ReactionTooltip',
  component: ReactionTooltip,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ReactionTooltip>;

const users = [
  { id: 'a', name: 'Alex', timestamp: new Date() },
  { id: 'b', name: 'Bea', timestamp: new Date() },
  { id: 'c', name: 'Cy', timestamp: new Date() },
];

export const Default: Story = {
  render: () => (
    <ReactionTooltip reactions={[{ emoji: '👍', users }]}>
      <button
        type="button"
        className="bg-muted rounded-full px-3 py-1 text-sm"
      >
        👍 3
      </button>
    </ReactionTooltip>
  ),
};

export const MultipleEmojis: Story = {
  render: () => (
    <ReactionTooltip
      reactions={[
        { emoji: '👍', users: users.slice(0, 2) },
        { emoji: '🎉', users: [users[2]!] },
      ]}
    >
      <button
        type="button"
        className="bg-muted rounded-full px-3 py-1 text-sm"
      >
        Mixed reactions
      </button>
    </ReactionTooltip>
  ),
};
