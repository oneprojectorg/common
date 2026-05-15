import type { Meta, StoryObj } from '@storybook/react-vite';

import { TextField } from '@/components/TextField';

const meta: Meta<typeof TextField> = {
  title: 'shadcn/TextField',
  component: TextField,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TextField>;

export const Default: Story = {
  args: { label: 'Email', inputProps: { placeholder: 'you@example.com' } },
};

export const WithDescription: Story = {
  args: {
    label: 'Email',
    description: "We'll never share.",
    inputProps: { placeholder: 'you@example.com' },
  },
};

export const WithError: Story = {
  args: {
    label: 'Email',
    errorMessage: 'Required',
    inputProps: { placeholder: 'you@example.com' },
  },
};

export const WithCounter: Story = {
  args: { label: 'Bio', maxLength: 100 },
};

export const Multiline: Story = {
  args: { label: 'Description', useTextArea: true, maxLength: 280 },
};

export const Required: Story = {
  args: { label: 'Email', isRequired: true },
};
