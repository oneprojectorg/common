import { StatusBadge } from '@op/sense/StatusBadge';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof StatusBadge> = {
  title: 'Sense/Composites/StatusBadge',
  component: StatusBadge,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof StatusBadge>;

// Every variant with its default icon.
export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <StatusBadge variant="inactive">Not started</StatusBadge>
      <StatusBadge variant="in-progress">In progress</StatusBadge>
      <StatusBadge variant="warning">Review out of date</StatusBadge>
      <StatusBadge variant="alert">Flagged</StatusBadge>
      <StatusBadge variant="success">Completed</StatusBadge>
      <StatusBadge variant="ghost">Status</StatusBadge>
    </div>
  ),
};

// With the trailing arrow — signals the badge drills into detail.
export const WithArrow: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <StatusBadge variant="success" hasArrow>
        Completed
      </StatusBadge>
      <StatusBadge variant="warning" hasArrow>
        Needs review
      </StatusBadge>
    </div>
  ),
};
