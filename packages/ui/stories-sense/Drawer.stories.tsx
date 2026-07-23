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

import { withSense } from './sense';

const meta: Meta<typeof Drawer> = {
  title: 'Sense/Primitives/Drawer',
  component: Drawer,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Drawer>;

// Drawer is vaul-based, so triggers compose with asChild rather than render.
const VOTE_BUDGET = 10;

function AllocateVotesDemo() {
  const [votes, setVotes] = React.useState(3);
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline">Allocate votes</Button>
      </DrawerTrigger>
      <DrawerContent className="sense">
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
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
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
      {(['top', 'right', 'bottom', 'left'] as const).map((direction) => (
        <Drawer key={direction} direction={direction}>
          <DrawerTrigger asChild>
            <Button variant="outline">{direction}</Button>
          </DrawerTrigger>
          <DrawerContent className="sense">
            <DrawerHeader>
              <DrawerTitle>Drawer from the {direction}</DrawerTitle>
              <DrawerDescription>
                This drawer slides in from the {direction} of the screen.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ))}
    </div>
  ),
};
