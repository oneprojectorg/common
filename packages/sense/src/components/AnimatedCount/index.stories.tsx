import { AnimatedCount } from '@op/sense/AnimatedCount';
import { Button } from '@op/sense/Button';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

const meta: Meta<typeof AnimatedCount> = {
  title: 'Composites/AnimatedCount',
  component: AnimatedCount,
  tags: ['autodocs'],
  args: { value: 42 },
};

export default meta;

type Story = StoryObj<typeof AnimatedCount>;

export const Default: Story = {};

// The travel distance is in `em`, so the component tracks whatever text size it
// inherits — no size prop, no measurement.
export const InheritsTextSize: Story = {
  render: () => (
    <div className="flex items-baseline gap-6">
      <span className="text-label">
        <AnimatedCount value={7} />
      </span>
      <span className="text-title">
        <AnimatedCount value={7} />
      </span>
      <span className="text-headline">
        <AnimatedCount value={7} />
      </span>
      <span className="text-display">
        <AnimatedCount value={7} />
      </span>
    </div>
  ),
};

// Both numbers travel the same way — up when the count grows, down when it
// shrinks. Nothing animates on first paint.
export const Interactive: Story = {
  render: () => <Counter />,
};

const Counter = () => {
  const [count, setCount] = useState(12);

  return (
    <div className="flex items-center gap-4">
      <Button
        size="icon-sm"
        variant="outline"
        aria-label="Decrement"
        onClick={() => setCount((c) => c - 1)}
      >
        −
      </Button>
      <span className="text-headline">
        <AnimatedCount value={count} />
      </span>
      <Button
        size="icon-sm"
        variant="outline"
        aria-label="Increment"
        onClick={() => setCount((c) => c + 1)}
      >
        +
      </Button>
    </div>
  );
};
