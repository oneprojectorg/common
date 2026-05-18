import type { Meta, StoryObj } from '@storybook/react-vite';

import { Avatar } from '@/components/Avatar';
import { GrowingFacePile } from '@/components/GrowingFacePile';

const meta: Meta<typeof GrowingFacePile> = {
  title: 'shadcn/GrowingFacePile',
  component: GrowingFacePile,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof GrowingFacePile>;

const names = Array.from({ length: 15 }, (_, i) => `User ${i + 1}`);

export const Default: Story = {
  render: () => (
    <GrowingFacePile
      items={names.map((n) => (
        <Avatar key={n} placeholder={n} size="sm" />
      ))}
    />
  ),
};

export const Constrained: Story = {
  decorators: [
    (Story) => (
      <div className="w-40">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <GrowingFacePile
      items={names.map((n) => (
        <Avatar key={n} placeholder={n} size="sm" />
      ))}
    />
  ),
};
