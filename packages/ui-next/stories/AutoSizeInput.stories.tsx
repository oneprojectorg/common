import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { AutoSizeInput } from '@/components/AutoSizeInput';

const meta: Meta<typeof AutoSizeInput> = {
  title: 'shadcn/AutoSizeInput',
  component: AutoSizeInput,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AutoSizeInput>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState('Type to grow');
    return (
      <AutoSizeInput
        aria-label="Auto sizing input"
        value={value}
        onChange={setValue}
        className="border-input rounded border bg-transparent px-2 py-1 text-sm outline-none"
      />
    );
  },
};
