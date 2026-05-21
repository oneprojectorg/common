import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuSearch } from 'react-icons/lu';

import { Input } from '@/components/Input';

const meta: Meta<typeof Input> = {
  title: 'shadcn/Input',
  component: Input,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: 'Type something' },
};

export const Sm: Story = {
  args: { placeholder: 'Small', size: 'sm' },
};

export const Muted: Story = {
  args: { placeholder: 'Muted', color: 'muted' },
};

export const Error: Story = {
  args: { placeholder: 'Invalid', color: 'error' },
};

export const Disabled: Story = {
  args: { placeholder: 'Disabled', disabled: true },
};

export const WithIcon: Story = {
  args: {
    placeholder: 'Search',
    icon: <LuSearch />,
  },
};

export const TypeNumber: Story = {
  args: { type: 'number', placeholder: '0' },
};

export const TypePassword: Story = {
  args: { type: 'password', placeholder: '••••••••' },
};
