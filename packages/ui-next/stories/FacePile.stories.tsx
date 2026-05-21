import type { Meta, StoryObj } from '@storybook/react-vite';

import { Avatar } from '@/components/Avatar';
import { FacePile } from '@/components/FacePile';

const meta: Meta<typeof FacePile> = {
  title: 'shadcn/FacePile',
  component: FacePile,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof FacePile>;

const names = ['Alex', 'Bea', 'Cy', 'Dani', 'Eli'];

export const Default: Story = {
  render: () => (
    <FacePile
      items={names.map((n) => (
        <Avatar key={n} placeholder={n} size="sm" />
      ))}
    />
  ),
};

export const WithLabel: Story = {
  render: () => (
    <FacePile
      items={names.slice(0, 3).map((n) => (
        <Avatar key={n} placeholder={n} size="sm" />
      ))}
    >
      <span className="text-muted-foreground text-sm">+3 more</span>
    </FacePile>
  ),
};
