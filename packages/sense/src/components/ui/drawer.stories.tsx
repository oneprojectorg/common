import { Button } from '@op/sense/Button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@op/sense/Drawer';
import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';
import { LuMinus, LuPlus } from 'react-icons/lu';

const meta: Meta<typeof Drawer> = {
  title: 'Primitives/Drawer',
  component: Drawer,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Drawer>;

// Drawer is Base UI based: triggers compose via `render` (not asChild), and the
// slide-in edge is set with `swipeDirection` (up / right / down / left).
const VOTE_BUDGET = 10;

function AllocateVotesDemo() {
  const [votes, setVotes] = React.useState(3);
  return (
    <Drawer showSwipeHandle>
      <DrawerTrigger render={<Button variant="outline" />}>
        Allocate votes
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Community garden proposal</DrawerTitle>
          <DrawerDescription>
            You have {VOTE_BUDGET - votes} of {VOTE_BUDGET} votes left this
            round.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex items-center justify-center gap-6 px-6 py-4">
          <Button
            variant="outline"
            size="icon-sm"
            className="rounded-full"
            aria-label="Remove a vote"
            disabled={votes <= 0}
            onClick={() => setVotes(votes - 1)}
          >
            <LuMinus />
          </Button>
          <div className="text-center">
            <div className="text-display font-strong tabular-nums">{votes}</div>
            <div className="text-xs text-muted-foreground uppercase">
              Votes on this proposal
            </div>
          </div>
          <Button
            variant="outline"
            size="icon-sm"
            className="rounded-full"
            aria-label="Add a vote"
            disabled={votes >= VOTE_BUDGET}
            onClick={() => setVotes(votes + 1)}
          >
            <LuPlus />
          </Button>
        </div>
        <DrawerFooter>
          <Button>Confirm allocation</Button>
          <DrawerClose render={<Button variant="outline" />}>
            Cancel
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export const Default: Story = {
  render: () => <AllocateVotesDemo />,
};

export const Directions: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      {(['up', 'right', 'down', 'left'] as const).map((direction) => (
        <Drawer key={direction} swipeDirection={direction} showSwipeHandle>
          <DrawerTrigger render={<Button variant="outline" />}>
            {direction}
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Drawer from the {direction}</DrawerTitle>
              <DrawerDescription>
                This drawer slides in from the {direction} of the screen.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <DrawerClose render={<Button variant="outline" />}>
                Close
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ))}
    </div>
  ),
};
