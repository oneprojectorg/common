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
import { useRef } from 'react';

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

// `anchor` positions the popup against something other than the trigger. Here
// the suggestion list hangs off the whole field, so it lines up with the field
// and matches its width, rather than off the small button that opened it.
export const Anchored: Story = {
  render: () => <AnchoredExample />,
};

// `container` chooses the popup's DOM parent. Portalled to the body by default;
// with `container` the popup renders inside the scroll box, so it travels with
// the sticky bar its trigger sits in instead of staying where the page was when
// it opened. Scroll the box with the popover open to see the difference.
export const PortalContainer: Story = {
  render: () => <PortalContainerExample />,
};

function AnchoredExample() {
  const field = useRef<HTMLDivElement>(null);

  return (
    <Popover>
      <div
        ref={field}
        className="flex w-80 items-center gap-2 rounded-lg border border-input p-2"
      >
        <Input
          aria-label="Invite by email"
          placeholder="name@example.com"
          className="h-8 border-0 shadow-none"
        />
        <PopoverTrigger render={<Button variant="outline" size="sm" />}>
          Suggestions
        </PopoverTrigger>
      </div>
      <PopoverContent
        anchor={field}
        align="start"
        className="w-(--anchor-width) gap-2"
      >
        <PopoverHeader>
          <PopoverTitle>Recent</PopoverTitle>
          <PopoverDescription>
            Anchored to the field, not to the button.
          </PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  );
}

function PortalContainerExample() {
  const box = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={box}
      className="relative h-64 w-80 overflow-y-auto rounded-lg border p-4"
    >
      <div className="sticky top-0 flex justify-end bg-background pb-2">
        <Popover>
          <PopoverTrigger render={<Button variant="outline" size="sm" />}>
            Filter
          </PopoverTrigger>
          <PopoverContent container={box} align="end" className="w-56">
            <PopoverHeader>
              <PopoverTitle>Filter</PopoverTitle>
              <PopoverDescription>
                Rendered inside the scroll box.
              </PopoverDescription>
            </PopoverHeader>
          </PopoverContent>
        </Popover>
      </div>
      {Array.from({ length: 12 }, (_, index) => (
        <p key={index} className="py-2 text-sm text-muted-foreground">
          Row {index + 1}
        </p>
      ))}
    </div>
  );
}
