import { Button } from '@op/sense/Button';
import { Spinner } from '@op/sense/Spinner';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Spinner> = {
  title: 'Primitives/Spinner',
  component: Spinner,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Spinner>;

export const Default: Story = {
  render: () => <Spinner />,
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner className="size-4" />
      <Spinner className="size-6" />
      <Spinner className="size-8" />
    </div>
  ),
};

export const InButton: Story = {
  render: () => (
    <Button disabled>
      <Spinner data-icon="inline-start" />
      Saving…
    </Button>
  ),
};
