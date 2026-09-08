import { Button } from '@op/sense/Button';
import { Input } from '@op/sense/Input';
import { Label } from '@op/sense/Label';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@op/sense/Sheet';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Sheet> = {
  title: 'Primitives/Sheet',
  component: Sheet,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Sheet>;

export const Default: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" />}>
        Open sheet
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit profile</SheetTitle>
          <SheetDescription>
            Make changes to your profile here. Click save when you're done.
          </SheetDescription>
        </SheetHeader>
        <div className="grid flex-1 auto-rows-min gap-4 px-6">
          <div className="grid gap-2">
            <Label htmlFor="sheet-name">Name</Label>
            <Input id="sheet-name" defaultValue="Frida Kahlo" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sheet-username">Username</Label>
            <Input id="sheet-username" defaultValue="@fridakahlo" />
          </div>
        </div>
        <SheetFooter>
          <Button>Save changes</Button>
          <SheetClose render={<Button variant="outline" />}>Cancel</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

export const Sides: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
        <Sheet key={side}>
          <SheetTrigger render={<Button variant="outline" />}>
            {side}
          </SheetTrigger>
          <SheetContent side={side}>
            <SheetHeader>
              <SheetTitle>Sheet from the {side}</SheetTitle>
              <SheetDescription>
                This sheet slides in from the {side} of the screen.
              </SheetDescription>
            </SheetHeader>
            <SheetFooter>
              <SheetClose render={<Button variant="outline" />}>
                Close
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  ),
};

export const CustomWidth: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      {(
        [
          { label: 'narrow', className: 'sm:max-w-xs' },
          { label: 'wide', className: 'sm:max-w-2xl' },
          { label: 'fixed 480px', className: 'w-[480px] sm:max-w-none' },
        ] as const
      ).map(({ label, className }) => (
        <Sheet key={label}>
          <SheetTrigger render={<Button variant="outline" />}>
            {label}
          </SheetTrigger>
          <SheetContent className={className}>
            <SheetHeader>
              <SheetTitle>Width: {label}</SheetTitle>
              <SheetDescription>
                Width comes from `className`; it merges over the default `w-7/8
                sm:max-w-sm`.
              </SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  ),
};
