import { Calendar } from '@op/sense/Calendar';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof Calendar> = {
  title: 'Sense/Calendar',
  component: Calendar,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Calendar>;

// Dates are pinned so Chromatic snapshots stay stable.
export const Default: Story = {
  render: () => (
    <Calendar
      mode="single"
      defaultMonth={new Date(2026, 5, 1)}
      selected={new Date(2026, 5, 15)}
      className="rounded border"
    />
  ),
};

export const Range: Story = {
  render: () => (
    <Calendar
      mode="range"
      numberOfMonths={2}
      defaultMonth={new Date(2025, 0)}
      selected={{ from: new Date(2025, 0, 12), to: new Date(2025, 1, 8) }}
      className="rounded border"
    />
  ),
};
