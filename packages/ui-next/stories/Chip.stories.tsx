import type { Meta, StoryObj } from '@storybook/react-vite';

import { Chip } from '@/components/Chip';

const meta: Meta<typeof Chip> = {
  title: 'shadcn/Chip',
  component: Chip,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Chip>;

export const Default: Story = {
  args: { children: 'active' },
};

export const Group: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Chip>active</Chip>
      <Chip>draft</Chip>
      <Chip>review</Chip>
    </div>
  ),
};
