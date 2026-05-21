import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { ComboBox, ComboBoxItem } from '@/components/ComboBox';

const meta: Meta = {
  title: 'shadcn/ComboBox',
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
type Story = StoryObj;

const FRUITS = [
  { id: 'apple', label: 'Apple' },
  { id: 'banana', label: 'Banana' },
  { id: 'cherry', label: 'Cherry' },
  { id: 'date', label: 'Date' },
];

export const Default: Story = {
  render: () => {
    const [key, setKey] = useState<string | null>(null);
    return (
      <ComboBox
        label="Fruit"
        placeholder="Pick one"
        items={FRUITS}
        selectedKey={key}
        onSelectionChange={setKey}
      >
        {(item) => (
          <ComboBoxItem id={item.id} textValue={item.label}>
            {item.label}
          </ComboBoxItem>
        )}
      </ComboBox>
    );
  },
};

export const Disabled: Story = {
  render: () => (
    <ComboBox label="Locked" items={FRUITS} isDisabled placeholder="—">
      {(item) => (
        <ComboBoxItem id={item.id} textValue={item.label}>
          {item.label}
        </ComboBoxItem>
      )}
    </ComboBox>
  ),
};
