import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { Confetti } from '@/components/Confetti';

const meta: Meta<typeof Confetti> = {
  title: 'shadcn/Confetti',
  component: Confetti,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Confetti>;

export const Default: Story = {
  render: () => {
    const [key, setKey] = useState(0);
    return (
      <div className="flex h-svh items-center justify-center">
        <Button onPress={() => setKey((k) => k + 1)}>Fire confetti</Button>
        <Confetti key={key} />
      </div>
    );
  },
};
