import { Button } from '@op/sense/Button';
import { Confetti } from '@op/sense/Confetti';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@op/sense/Dialog';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

const meta: Meta<typeof Confetti> = {
  title: 'Composites/Confetti',
  component: Confetti,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Confetti>;

// How it's used in the app: a success modal that bursts confetti on open. Pass
// `confetti` to `DialogContent` — it renders the viewport-fixed overlay behind
// the card (between backdrop and card) and replays on each open.
const CelebrationDemo = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Complete setup</DialogTrigger>
      <DialogContent confetti>
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
