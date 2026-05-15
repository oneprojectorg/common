import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatusDot } from '@/components/StatusDot';

const meta: Meta<typeof StatusDot> = {
  title: 'shadcn/StatusDot',
  component: StatusDot,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof StatusDot>;

export const Success: Story = { args: { intent: 'success', children: 'Live' } };
export const Warning: Story = {
  args: { intent: 'warning', children: 'Pending' },
};
export const Danger: Story = {
  args: { intent: 'danger', children: 'Failed' },
};
export const Neutral: Story = {
  args: { intent: 'neutral', children: 'Archived' },
};

export const AllIntents: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <StatusDot intent="success">Live</StatusDot>
      <StatusDot intent="warning">Pending</StatusDot>
      <StatusDot intent="danger">Failed</StatusDot>
      <StatusDot intent="neutral">Archived</StatusDot>
    </div>
  ),
};
