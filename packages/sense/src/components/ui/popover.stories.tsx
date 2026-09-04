import { Button } from '@op/sense/Button';
import { Input } from '@op/sense/Input';
import { Label } from '@op/sense/Label';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@op/sense/Popover';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Popover> = {
  title: 'Primitives/Popover',
  component: Popover,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Popover>;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" />}>
        Open popover
      </PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Dimensions</PopoverTitle>
          <PopoverDescription>
            Set the dimensions for the layer.
          </PopoverDescription>
        </PopoverHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-3 items-center gap-4">
            <Label htmlFor="popover-width">Width</Label>
            <Input
              id="popover-width"
              defaultValue="100%"
              className="col-span-2 h-8"
            />
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <Label htmlFor="popover-height">Height</Label>
            <Input
              id="popover-height"
              defaultValue="25px"
              className="col-span-2 h-8"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

export const Sides: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
        <Popover key={side}>
          <PopoverTrigger render={<Button variant="outline" />}>
            {side}
          </PopoverTrigger>
          <PopoverContent side={side} className="w-56">
            <PopoverHeader>
              <PopoverTitle>Popover on {side}</PopoverTitle>
              <PopoverDescription>
                This popover opens on the {side} of the trigger.
              </PopoverDescription>
            </PopoverHeader>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  ),
};
