import { Button } from '@op/sense/Button';
import { Confetti } from '@op/sense/Confetti';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from '@op/sense/Dialog';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { withSense } from './sense';

const meta: Meta<typeof Confetti> = {
  title: 'Sense/Composites/Confetti',
  component: Confetti,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Confetti>;

// How it's used in the app: a success modal that bursts confetti on open. The
// effect is a viewport-fixed overlay portaled to `<body>` (alongside the
// dialog) so Storybook's story wrapper doesn't trap it. It's layered between
// the dimmed backdrop (`z-50`) and the modal card (bumped to `z-[60]`) via an
// `isolate` wrapper, so confetti bursts behind the card, not over its text.
// Remounted via `key` each open so it replays.
const CelebrationDemo = () => {
  const [open, setOpen] = useState(false);
  const [burst, setBurst] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setBurst((n) => n + 1);
        }
      }}
    >
      <DialogTrigger render={<Button />}>Complete setup</DialogTrigger>
      {open ? (
        <DialogPortal>
          <div className="pointer-events-none fixed inset-0 isolate z-[55]">
            <Confetti key={burst} />
          </div>
        </DialogPortal>
      ) : null}
      <DialogContent className="sense z-[60]">
        <DialogHeader>
          <DialogTitle>🎉 You’re all set!</DialogTitle>
          <DialogDescription>
            Your decision process is live and ready to share.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button />}>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const Celebration: Story = {
  render: () => <CelebrationDemo />,
};
