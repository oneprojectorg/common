import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { ToggleButton } from '@/components/ToggleButton';

const meta: Meta<typeof ToggleButton> = {
  title: 'shadcn/ToggleButton',
  component: ToggleButton,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ToggleButton>;

export const Default: Story = {
  render: () => {
    const [on, setOn] = useState(false);
    return <ToggleButton isSelected={on} onChange={setOn} />;
  },
};

export const Small: Story = {
  render: () => {
    const [on, setOn] = useState(true);
    return <ToggleButton isSelected={on} onChange={setOn} size="small" />;
  },
};

export const Disabled: Story = {
  render: () => (
    <div className="flex gap-3">
      <ToggleButton isSelected={false} isDisabled />
      <ToggleButton isSelected isDisabled />
    </div>
  ),
};
