import { CommentButton } from '@op/sense/CommentButton';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof CommentButton> = {
  title: 'Composites/CommentButton',
  component: CommentButton,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof CommentButton>;

export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <CommentButton count={0} label="0 comments" />
      <CommentButton count={3} label="3 comments" />
      <CommentButton count={12} label="12 تعليقًا" dir="rtl" />
    </div>
  ),
};

/** The post detail page shows the count without offering the action. */
export const Disabled: Story = {
  render: () => <CommentButton count={3} label="3 comments" disabled />,
};
