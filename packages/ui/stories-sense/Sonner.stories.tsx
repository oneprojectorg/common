import { Button } from '@op/sense/Button';
import { Toaster } from '@op/sense/Sonner';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { toast } from 'sonner';

import { withSense } from './sense';

const meta: Meta<typeof Toaster> = {
  title: 'Sense/Sonner',
  component: Toaster,
  decorators: [withSense],
};

export default meta;

type Story = StoryObj<typeof Toaster>;

// Toasts render in a portal outside the `.sense` wrapper, so the Toaster
// re-scopes itself with `className="sense"`.
export const Default: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button
        variant="outline"
        onClick={() =>
          toast('Event created', {
            description: 'Friday, July 17 at 10:00 AM',
            action: { label: 'Undo', onClick: () => {} },
          })
        }
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
      <Toaster className="sense" />
    </div>
  ),
};
