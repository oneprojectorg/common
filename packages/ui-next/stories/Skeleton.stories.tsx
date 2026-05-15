import type { Meta, StoryObj } from '@storybook/react-vite';

import { Skeleton, SkeletonLine } from '@/components/Skeleton';

const meta = {
  title: 'shadcn/Skeleton',
  component: Skeleton,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Block: Story = {
  args: { className: 'h-8 w-64' },
};

export const Stack: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-12 w-80" />
    </div>
  ),
};

export const Lines: Story = {
  render: () => <SkeletonLine lines={3} />,
};
