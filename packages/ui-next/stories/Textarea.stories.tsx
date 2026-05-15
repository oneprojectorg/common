import type { Meta, StoryObj } from '@storybook/react-vite';

import { Textarea } from '@/components/Textarea';

const meta: Meta<typeof Textarea> = {
  title: 'shadcn/Textarea',
  component: Textarea,
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
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  args: { placeholder: 'Type something', rows: 4 },
};

export const Borderless: Story = {
  args: {
    placeholder: 'No border / no padding',
    variant: 'borderless',
    rows: 4,
  },
};

export const Disabled: Story = {
  args: { placeholder: 'Disabled', disabled: true, rows: 4 },
};

export const WithDefaultValue: Story = {
  args: {
    defaultValue: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    rows: 4,
  },
};
