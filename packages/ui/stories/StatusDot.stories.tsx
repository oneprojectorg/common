import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatusDot } from '../src/components/StatusDot';

const meta: Meta<typeof StatusDot> = {
  title: 'StatusDot',
  component: StatusDot,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    intent: {
      control: { type: 'select' },
      options: ['success', 'danger', 'warning', 'neutral'],
    },
    className: {
      control: { type: 'text' },
    },
    children: {
      control: { type: 'text' },
    },
  },
  args: {
    intent: 'neutral',
    children: 'Status',
  },
};

export default meta;

type Story = StoryObj<typeof StatusDot>;

export const Success: Story = {
  args: { intent: 'success', children: 'Approved' },
};

export const Danger: Story = {
  args: { intent: 'danger', children: 'Rejected' },
};

export const Warning: Story = {
  args: { intent: 'warning', children: 'Maybe' },
};

export const Neutral: Story = {
  args: { intent: 'neutral', children: 'Pending' },
};

export const GroupHeading: Story = {
  args: {
    intent: 'warning',
    children: (
      <span className="font-serif !text-title-sm14 text-neutral-black">
        Maybe (3)
      </span>
    ),
  },
};

export const AllIntents: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <StatusDot intent="success">
        <span className="text-sm text-neutral-black">Success</span>
      </StatusDot>
      <StatusDot intent="danger">
        <span className="text-sm text-neutral-black">Danger</span>
      </StatusDot>
      <StatusDot intent="warning">
        <span className="text-sm text-neutral-black">Warning</span>
      </StatusDot>
      <StatusDot intent="neutral">
        <span className="text-sm text-neutral-black">Neutral</span>
      </StatusDot>
    </div>
  ),
};
