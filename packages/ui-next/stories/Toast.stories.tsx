import type { Meta, StoryObj } from '@storybook/react-vite';
import { toast } from 'sonner';

import { Toast, toast as opToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';

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
    <Button onClick={() => toast.success('Saved successfully')}>
      Show success
    </Button>
  ),
};

export const Error: Story = {
  render: () => (
    <Button
      variant="destructive"
      onClick={() =>
        toast.error("That didn't work", { description: 'Try again.' })
      }
    >
      Show error
    </Button>
  ),
};

export const TitleWithDescription: Story = {
  render: () => (
    <Button
      onClick={() =>
        toast.success('Heads up', {
          description: 'Long-running message with a close button.',
        })
      }
    >
      Show with description
    </Button>
  ),
};

export const StatusHelper: Story = {
  render: () => (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => opToast.status({ code: 404 })}>
        404
      </Button>
      <Button variant="outline" onClick={() => opToast.status({ code: 403 })}>
        403
      </Button>
      <Button variant="outline" onClick={() => opToast.status({ code: 500 })}>
        500
      </Button>
    </div>
  ),
};
