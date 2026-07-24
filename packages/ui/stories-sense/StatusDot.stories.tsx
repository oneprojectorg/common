import { StatusDot } from '@op/sense/StatusDot';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof StatusDot> = {
  title: 'Sense/Composites/StatusDot',
  component: StatusDot,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof StatusDot>;

export const Intents: Story = {
  render: () => (
    <div className="flex flex-col gap-3 text-base">
      <StatusDot intent="success">Approved</StatusDot>
      <StatusDot intent="danger">Rejected</StatusDot>
      <StatusDot intent="warning">Needs review</StatusDot>
      <StatusDot intent="neutral">Draft</StatusDot>
    </div>
  ),
};
