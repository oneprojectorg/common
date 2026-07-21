import { Button } from '@op/sense/Button';
import { Confetti } from '@op/sense/Confetti';
import { LogoLoop } from '@op/sense/LogoLoop';
import { CheckIcon, MegaphoneIcon } from '@op/sense/icons';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { withSense } from './sense';

// Visual effects + the two bespoke SVG icons, in one story file.

const meta: Meta = {
  title: 'Sense/Composites/Effects & icons',
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj;

// Confetti bursts once on mount — remount to replay.
const ConfettiDemo = () => {
  const [burst, setBurst] = useState(0);

  return (
    <div className="relative flex h-64 w-full items-center justify-center overflow-hidden rounded-lg border">
      {burst > 0 ? <Confetti key={burst} /> : null}
      <Button onClick={() => setBurst((n) => n + 1)}>Celebrate 🎉</Button>
    </div>
  );
};

export const ConfettiBurst: Story = {
  render: () => <ConfettiDemo />,
};

const demoLogo = (label: string) => ({
  node: (
    <span className="flex h-8 items-center rounded border bg-muted px-4 text-sm text-muted-foreground">
      {label}
    </span>
  ),
  title: label,
});

export const Marquee: Story = {
  render: () => (
    <div className="w-full max-w-xl">
      <LogoLoop
        logos={['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'].map(demoLogo)}
        speed={60}
        gap={24}
        fadeOut
        ariaLabel="Partner logos"
      />
    </div>
  ),
};

export const Icons: Story = {
  render: () => (
    <div className="flex items-center gap-6 text-foreground">
      <div className="flex flex-col items-center gap-1">
        <CheckIcon className="size-6" />
        <span className="text-xs text-muted-foreground">CheckIcon</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <MegaphoneIcon className="size-6" />
        <span className="text-xs text-muted-foreground">MegaphoneIcon</span>
      </div>
    </div>
  ),
};
