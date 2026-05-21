import type { Meta, StoryObj } from '@storybook/react-vite';

import { NumberField } from '@/components/NumberField';

const meta: Meta<typeof NumberField> = {
  title: 'shadcn/NumberField',
  component: NumberField,
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
type Story = StoryObj<typeof NumberField>;

export const Default: Story = { args: { label: 'Quantity' } };

export const WithBounds: Story = {
  args: { label: 'Score', minValue: 0, maxValue: 100 },
};

export const WithPrefix: Story = {
  args: { label: 'Budget', prefixText: '$' },
};

export const WithError: Story = {
  args: { label: 'Score', errorMessage: 'Out of range' },
};
