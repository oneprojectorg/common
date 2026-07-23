import { Button } from '@op/sense/Button';
import { Toaster, toast } from '@op/sense/Sonner';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof Toaster> = {
  title: 'Sense/Primitives/Sonner',
  component: Toaster,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Toaster>;

// The toaster renders inline (position:fixed, no portal), so it inherits the
// `.sense` scope from the story wrapper — no re-scoping needed.
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
      <Toaster />
    </div>
  ),
};
