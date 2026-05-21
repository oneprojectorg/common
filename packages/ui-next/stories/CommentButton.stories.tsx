import type { Meta, StoryObj } from '@storybook/react-vite';

import { CommentButton } from '@/components/CommentButton';

const meta: Meta<typeof CommentButton> = {
  title: 'shadcn/CommentButton',
  component: CommentButton,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CommentButton>;

export const Default: Story = { args: { count: 0 } };
export const WithCount: Story = { args: { count: 12 } };
export const Disabled: Story = { args: { count: 3, isDisabled: true } };
