import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { DragHandle, Sortable } from '@/components/Sortable';

const meta: Meta = {
  title: 'shadcn/Sortable',
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[28rem]">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const [items, setItems] = useState([
      { id: 'apple', label: 'Apple' },
      { id: 'banana', label: 'Banana' },
      { id: 'cherry', label: 'Cherry' },
      { id: 'date', label: 'Date' },
    ]);
    return (
      <Sortable items={items} onChange={setItems}>
        {(item, controls) => (
          <div className="flex items-center gap-2 rounded border bg-muted/40 p-2">
            <DragHandle
              {...controls.dragHandleProps}
              aria-label={`Drag ${item.label}`}
            />
            <span>{item.label}</span>
          </div>
        )}
      </Sortable>
    );
  },
};
