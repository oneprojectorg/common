import { Avatar, AvatarFallback } from '@op/sense/Avatar';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@op/sense/HoverCard';
import { getGradientForString } from '@op/styles/constants';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuCalendarDays } from 'react-icons/lu';

import { withSense } from './sense';

const meta: Meta<typeof HoverCard> = {
  title: 'Sense/Primitives/HoverCard',
  component: HoverCard,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof HoverCard>;

export const Default: Story = {
  render: () => (
    <HoverCard>
      <HoverCardTrigger
        href="#"
        className="text-sm font-strong text-primary hover:underline"
      >
        @fridakahlo
      </HoverCardTrigger>
      <HoverCardContent className="sense">
        <div className="flex gap-4">
          <Avatar>
            <AvatarFallback
              className={`${getGradientForString('Frida Kahlo')} text-white`}
            >
              FK
            </AvatarFallback>
          </Avatar>
          <div className="grid gap-1">
            <p className="font-strong">Frida Kahlo</p>
            <p className="text-muted-foreground">
              Painter known for portraits, self-portraits, and works inspired by
              nature.
            </p>
            <div className="flex items-center gap-2 pt-1 text-muted-foreground">
              <LuCalendarDays className="size-4" />
              <span>Joined December 2021</span>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
};

export const Sides: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-8">
      {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
        <HoverCard key={side}>
          <HoverCardTrigger
            href="#"
            className="text-sm font-strong text-primary hover:underline"
          >
            {side}
          </HoverCardTrigger>
          <HoverCardContent side={side} className="sense w-56">
            This hover card opens on the {side} of the trigger.
          </HoverCardContent>
        </HoverCard>
      ))}
    </div>
  ),
};
