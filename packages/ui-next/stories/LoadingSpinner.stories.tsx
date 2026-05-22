import type { Meta, StoryObj } from '@storybook/react-vite';

import { LoadingSpinner } from '@/components/LoadingSpinner';

const meta: Meta<typeof LoadingSpinner> = {
  title: 'shadcn/LoadingSpinner',
  component: LoadingSpinner,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof LoadingSpinner>;

export const Teal: Story = { args: { color: 'teal' } };
export const Gray: Story = { args: { color: 'gray' } };

export const InButton: Story = {
  render: () => (
    <button
      type="button"
      className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm text-primary-foreground"
      disabled
    >
      <LoadingSpinner color="gray" />
      Saving…
    </button>
  ),
};
