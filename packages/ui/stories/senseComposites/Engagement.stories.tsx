import { CommentButton } from '@op/sense/CommentButton';
import { ReactionsButton } from '@op/sense/ReactionsButton';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Pair, Section } from '../../src/comparison/Comparison';
import { CommentButton as OldCommentButton } from '../../src/components/CommentButton';
import { ReactionsButton as OldReactionsButton } from '../../src/components/ReactionsButton';

const meta: Meta = {
  title: 'Sense Comparison/Composites/Engagement',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

const reactions = [
  {
    emoji: '👍',
    count: 3,
    isActive: true,
    users: [{ id: '1', name: 'Frida Kahlo', timestamp: new Date() }],
  },
  { emoji: '🎉', count: 1 },
];

export const EngagementComparison: Story = {
  name: 'Engagement',
  render: () => (
    <div className="p-8">
      <Section title="ReactionsButton">
        <Pair
          label="Reactions"
          old={
            <OldReactionsButton
              reactions={reactions}
              onReactionClick={() => {}}
              onAddReaction={() => {}}
            />
          }
          raw={
            <ReactionsButton
              reactions={reactions}
              onReactionClick={() => {}}
              onAddReaction={() => {}}
            />
          }
        />
      </Section>
      <Section title="CommentButton">
        <Pair
          label="Count button"
          old={<OldCommentButton count={3} label="3 comments" />}
          raw={<CommentButton count={3} label="3 comments" />}
        />
      </Section>
    </div>
  ),
};
