import { CommentButton } from '@op/sense/CommentButton';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof CommentButton> = {
  title: 'Sense/Composites/CommentButton',
  component: CommentButton,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof CommentButton>;

export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <CommentButton count={0} label="0 comments" />
      <CommentButton count={3} label="3 comments" />
      <CommentButton count={12} label="12 تعليقًا" dir="rtl" />
    </div>
  ),
};
