import { Button } from '@op/sense/Button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@op/sense/Tooltip';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuPlus } from 'react-icons/lu';

import { withSense } from './sense';

const meta: Meta<typeof Tooltip> = {
  title: 'Sense/Primitives/Tooltip',
  component: Tooltip,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<Button variant="outline" />}>
          Hover me
        </TooltipTrigger>
        <TooltipContent className="sense">This is a tooltip</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};

export const Sides: Story = {
  render: () => (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-4">
        {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
          <Tooltip key={side}>
            <TooltipTrigger render={<Button variant="outline" />}>
              {side}
            </TooltipTrigger>
            <TooltipContent side={side} className="sense">
              Tooltip on the {side}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  ),
};

export const IconTrigger: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={<Button variant="outline" size="icon" aria-label="Add" />}
        >
          <LuPlus />
        </TooltipTrigger>
        <TooltipContent className="sense">Add to library</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};
