import { SegmentedProgress } from '@op/sense/SegmentedProgress';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof SegmentedProgress> = {
  title: 'Composites/SegmentedProgress',
  component: SegmentedProgress,
  tags: ['autodocs'],
  args: { 'aria-label': 'Budget allocated', className: 'max-w-md' },
};

export default meta;

type Story = StoryObj<typeof SegmentedProgress>;

export const Default: Story = {
  args: {
    max: 1000000,
    segments: [
      { id: 'garden', value: 150000 },
      { id: 'bike-lanes', value: 180000 },
      { id: 'library', value: 95000 },
      { id: 'mural', value: 25000 },
    ],
    getAriaValueText: () => '$450,000 of $1,000,000 allocated',
  },
};

export const Empty: Story = {
  args: { max: 1000000, segments: [] },
};

export const Full: Story = {
  args: {
    max: 100,
    segments: [
      { id: 'a', value: 60 },
      { id: 'b', value: 40 },
    ],
  },
};
