import { Button } from '@op/sense/Button';
import { Confetti } from '@op/sense/Confetti';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { withSense } from './sense';

const meta: Meta<typeof Confetti> = {
  title: 'Sense/Composites/Confetti',
  component: Confetti,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Confetti>;

// Confetti bursts once on mount — remount (via `key`) to replay.
const ConfettiDemo = () => {
  const [burst, setBurst] = useState(0);

  return (
    <div className="relative flex h-64 w-full items-center justify-center overflow-hidden rounded-lg border">
      {burst > 0 ? <Confetti key={burst} /> : null}
      <Button onClick={() => setBurst((n) => n + 1)}>Celebrate 🎉</Button>
    </div>
  );
};

export const Burst: Story = {
  render: () => <ConfettiDemo />,
};
