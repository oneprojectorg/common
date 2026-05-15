import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuLeaf, LuUsers } from 'react-icons/lu';

import { EmptyState } from '@/components/EmptyState';

const meta: Meta<typeof EmptyState> = {
  title: 'shadcn/EmptyState',
  component: EmptyState,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[28rem]">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  render: () => (
    <EmptyState>
      <p className="text-sm">Nothing to show.</p>
    </EmptyState>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <EmptyState icon={<LuLeaf />}>
      <p className="text-sm">No proposals yet</p>
      <p className="text-xs">You could be the first to submit one.</p>
    </EmptyState>
  ),
};

export const Members: Story = {
  render: () => (
    <EmptyState icon={<LuUsers />}>
      <p className="text-sm">No members yet</p>
    </EmptyState>
  ),
};
