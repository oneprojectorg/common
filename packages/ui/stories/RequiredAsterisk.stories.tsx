import type { Meta, StoryObj } from '@storybook/react-vite';

import { RequiredAsterisk } from '../src/components/RequiredAsterisk';

const meta: Meta<typeof RequiredAsterisk> = {
  title: 'Legacy/RequiredAsterisk',
  component: RequiredAsterisk,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: { type: 'text' },
    },
  },
};

export default meta;

type Story = StoryObj<typeof RequiredAsterisk>;

export const Default: Story = {
  render: (args) => (
    <span className="font-serif text-title-sm14 text-neutral-charcoal">
      Field title
      <RequiredAsterisk {...args} />
    </span>
  ),
};
