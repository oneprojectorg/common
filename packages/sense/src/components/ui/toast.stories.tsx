import { Button } from '@op/sense/Button';
import { Toaster, toast } from '@op/sense/Toast';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Toaster> = {
  title: 'Primitives/Toast',
  component: Toaster,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Toaster>;

export const Default: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button
        variant="outline"
        onClick={() => {
          const id = toast('Event created', {
            description: 'Friday, July 17 at 10:00 AM',
            action: { label: 'Undo', onClick: () => toast.close(id) },
          });
        }}
      >
        Show toast
      </Button>
      <Button variant="outline" onClick={() => toast.success('Changes saved')}>
        Success
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.info('A new version is available')}
      >
        Info
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.warning('Storage is almost full')}
      >
        Warning
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.error('Something went wrong')}
      >
        Error
      </Button>
      <Toaster />
    </div>
  ),
};
