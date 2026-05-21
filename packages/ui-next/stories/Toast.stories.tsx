import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '@/components/Button';
import { Toast, toast } from '@/components/Toast';

const meta: Meta = {
  title: 'shadcn/Toast',
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <>
        <Toast />
        <Story />
      </>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const Success: Story = {
  render: () => (
    <Button onPress={() => toast.success({ message: 'Saved successfully' })}>
      Show success
    </Button>
  ),
};

export const Error: Story = {
  render: () => (
    <Button
      color="destructive"
      onPress={() =>
        toast.error({ title: "That didn't work", message: 'Try again.' })
      }
    >
      Show error
    </Button>
  ),
};

export const Dismissable: Story = {
  render: () => (
    <Button
      onPress={() =>
        toast.success({
          title: 'Heads up',
          message: 'Long-running message with a close button.',
          dismissable: true,
        })
      }
    >
      Show dismissable
    </Button>
  ),
};
