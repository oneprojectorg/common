import { Button } from '@op/sense/Button';
import { Toaster, toast } from '@op/sense/Toast';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof Toaster> = {
  title: 'Sense/Primitives/Toast',
  component: Toaster,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Toaster>;

// base-ui's Toaster portals its viewport to document.body, so it renders
// outside the withSense `.sense` shim. That only matters in Storybook — sense
// tokens live at :root in the app, so production toasts are styled correctly.
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
