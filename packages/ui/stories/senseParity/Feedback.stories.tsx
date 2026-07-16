import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@op/sense/Alert';
import { Button } from '@op/sense/Button';
import { Progress } from '@op/sense/Progress';
import { Skeleton } from '@op/sense/Skeleton';
import { Toaster, toast } from '@op/sense/Sonner';
import { Spinner } from '@op/sense/Spinner';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuCircleAlert } from 'react-icons/lu';

import figmaAlert from '../assets/figma/alert.png';
import figmaProgress from '../assets/figma/progress.png';
import figmaSkeleton from '../assets/figma/skeleton.png';
import figmaSonner from '../assets/figma/sonner.png';
import figmaSpinner from '../assets/figma/spinner.png';
import { ParityGridHeader, ParityRow, withDesignScale } from './Parity';

// Figma parity for the feedback family. See Parity.tsx for the conventions.

const meta: Meta = {
  title: 'Sense Comparison/Figma Parity/Feedback',
  parameters: { layout: 'fullscreen' },
  decorators: [withDesignScale],
};

export default meta;

type Story = StoryObj;

export const Feedback: Story = {
  name: 'Feedback',
  render: () => (
    <div className="flex flex-col gap-10 p-8">
      <ParityGridHeader />

      <ParityRow label="Alert" img={figmaAlert} imgWidth={634}>
        <Alert>
          <LuCircleAlert />
          <AlertTitle>Alert Title</AlertTitle>
          <AlertDescription>This is an alert description.</AlertDescription>
          <AlertAction>
            <Button variant="outline" size="sm">
              Undo
            </Button>
          </AlertAction>
        </Alert>
      </ParityRow>

      {/* Toasts only appear on demand (the toaster is fixed-position, rendered
          inline), so there is no static live rendering to place next to the
          mock. Reviewers: click the button and compare the toast that
          appears with the Figma export. */}
      <ParityRow label="Sonner" img={figmaSonner} imgWidth={358}>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            toast('Title Text', {
              description: 'This is a toast description.',
              action: { label: 'Undo', onClick: () => {} },
            })
          }
        >
          Show toast
        </Button>
        <Toaster />
      </ParityRow>

      <ParityRow label="Skeleton" img={figmaSkeleton} imgWidth={206}>
        <div className="flex items-center gap-4">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-[150px]" />
            <Skeleton className="h-4 w-[100px]" />
          </div>
        </div>
      </ParityRow>

      <ParityRow label="Spinner" img={figmaSpinner} imgWidth={16}>
        <Spinner />
      </ParityRow>

      <ParityRow label="Progress, 50%" img={figmaProgress} imgWidth={400}>
        <Progress value={50} />
      </ParityRow>
    </div>
  ),
};
