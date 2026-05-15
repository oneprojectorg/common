import type { Meta, StoryObj } from '@storybook/react-vite';

import { Separator } from '@/components/Separator';

const meta = {
  title: 'shadcn/Separator',
  component: Separator,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <span>Above</span>
      <Separator />
      <span>Below</span>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-8 items-center gap-3">
      <span>Left</span>
      <Separator orientation="vertical" />
      <span>Right</span>
    </div>
  ),
};
