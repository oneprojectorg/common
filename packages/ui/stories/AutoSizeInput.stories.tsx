import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { AutoSizeInput } from '../src/components/AutoSizeInput';

const meta: Meta<typeof AutoSizeInput> = {
  component: AutoSizeInput,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof AutoSizeInput>;

function AutoSizeInputDemo({
  initialValue = '',
  ...props
}: Omit<React.ComponentProps<typeof AutoSizeInput>, 'value' | 'onChange'> & {
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue);
  return <AutoSizeInput value={value} onChange={setValue} {...props} />;
}

export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-2 rounded border border-neutral-gray2 bg-white p-2">
      <AutoSizeInputDemo
        initialValue="Type here"
        aria-label="Auto-sizing input"
      />
    </div>
  ),
};

export const WithStyling: Story = {
  render: () => (
    <div className="flex items-center gap-2 rounded border border-neutral-gray2 bg-neutral-gray1 px-3 py-2">
      <span className="text-neutral-gray4">Label:</span>
      <AutoSizeInputDemo
        initialValue="Styled input"
        className="font-medium text-neutral-charcoal"
        aria-label="Styled auto-sizing input"
      />
    </div>
  ),
};

export const EmptyState: Story = {
  render: () => (
    <div className="flex items-center gap-2 rounded border border-neutral-gray2 bg-white p-2">
      <AutoSizeInputDemo initialValue="" aria-label="Empty auto-sizing input" />
    </div>
  ),
};

export const LongText: Story = {
  render: () => (
    <div className="flex items-center gap-2 rounded border border-neutral-gray2 bg-white p-2">
      <AutoSizeInputDemo
        initialValue="This is a longer piece of text that will make the input grow"
        aria-label="Long text auto-sizing input"
      />
    </div>
  ),
};

export const CustomMinWidth: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-neutral-gray4">
          minWidth=30 (default):
        </span>
        <div className="rounded border border-neutral-gray2 bg-white p-2">
          <AutoSizeInputDemo
            initialValue=""
            minWidth={30}
            aria-label="Default min width"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-neutral-gray4">minWidth=100:</span>
        <div className="rounded border border-neutral-gray2 bg-white p-2">
          <AutoSizeInputDemo
            initialValue=""
            minWidth={100}
            aria-label="Custom min width"
          />
        </div>
      </div>
    </div>
  ),
};

/**
 * Demonstrates constraining the input within a flex container.
 * Uses min-w-0 and overflow-hidden on a wrapper to prevent the input
 * from overflowing when text is longer than available space.
 */
export const ConstrainedWidth: Story = {
  render: () => (
    <div className="flex max-w-64 items-center gap-2 rounded border border-neutral-gray2 bg-neutral-gray1 px-2 py-1">
      <span className="shrink-0 text-neutral-gray4">📝</span>
      <div className="min-w-0 overflow-hidden">
        <AutoSizeInputDemo
          initialValue="This is a very long field label that should be clipped"
          className="text-neutral-charcoal"
          aria-label="Constrained auto-sizing input"
        />
      </div>
    </div>
  ),
};
