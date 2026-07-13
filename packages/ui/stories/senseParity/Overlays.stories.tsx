import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@op/sense/AlertDialog';
import { Button } from '@op/sense/Button';
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
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@op/sense/HoverCard';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@op/sense/Popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@op/sense/Sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@op/sense/Tooltip';
import type { Meta, StoryObj } from '@storybook/react-vite';

import figmaAlertDialog from '../assets/figma/alert-dialog.png';
import figmaDialog from '../assets/figma/dialog.png';
import figmaDrawer from '../assets/figma/drawer.png';
import figmaHoverCard from '../assets/figma/hover-card.png';
import figmaPopover from '../assets/figma/popover.png';
import figmaSheet from '../assets/figma/sheet.png';
import figmaTooltip from '../assets/figma/tooltip.png';
import { ParityGridHeader, ParityRow, withDesignScale } from './Parity';

// Figma parity for the overlays family. See Parity.tsx for the conventions.
//
// Overlays are portal-based, so the live column renders each component's
// trigger button wired to the real component — open it interactively to
// compare against the Figma export.

const meta: Meta = {
  title: 'Sense Comparison/Figma Parity/Overlays',
  parameters: { layout: 'fullscreen' },
  decorators: [withDesignScale],
};

export default meta;

type Story = StoryObj;

export const Overlays: Story = {
  name: 'Overlays',
  render: () => (
    <div className="flex flex-col gap-10 p-8">
      <ParityGridHeader />

      <ParityRow label="Dialog" img={figmaDialog} imgWidth={425}>
        <Dialog>
          <DialogTrigger render={<Button variant="outline" />}>
            Open dialog
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog title</DialogTitle>
              <DialogDescription>
                This is a dialog description.
              </DialogDescription>
            </DialogHeader>
            <div className="px-6 pt-8 pb-10">
              <div className="flex items-center justify-center rounded-md border border-dashed p-8 text-muted-foreground">
                Remove this frame and add your content
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button>Save changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ParityRow>

      <ParityRow label="Alert dialog" img={figmaAlertDialog} imgWidth={384}>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="outline" />}>
            Open alert dialog
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete your
                account from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>Continue</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ParityRow>

      <ParityRow label="Sheet" img={figmaSheet} imgWidth={592}>
        <Sheet>
          <SheetTrigger render={<Button variant="outline" />}>
            Open sheet
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Title Text</SheetTitle>
              <SheetDescription>This is a sheet description.</SheetDescription>
            </SheetHeader>
            <div className="flex-1 px-6">
              <div className="flex h-full items-center justify-center rounded-md border border-dashed p-8 text-muted-foreground">
                Remove this frame and add your content
              </div>
            </div>
            <SheetFooter>
              <Button>Button</Button>
              <Button variant="outline">Button</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </ParityRow>

      <ParityRow label="Drawer" img={figmaDrawer} imgWidth={424}>
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline">Open drawer</Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Title Text</DrawerTitle>
              <DrawerDescription>
                This is a drawer description.
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-6">
              <div className="flex items-center justify-center rounded-md border border-dashed p-8 text-muted-foreground">
                Remove this frame and add your content
              </div>
            </div>
            <DrawerFooter>
              <Button>Submit</Button>
              <DrawerClose asChild>
                <Button variant="outline">Cancel</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </ParityRow>

      <ParityRow label="Popover" img={figmaPopover} imgWidth={330}>
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
            <div className="flex items-center justify-center rounded-md border border-dashed p-8 text-muted-foreground">
              Remove this frame and add your content
            </div>
          </PopoverContent>
        </Popover>
      </ParityRow>

      <ParityRow label="Tooltip" img={figmaTooltip} imgWidth={120}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger render={<Button variant="outline" />}>
              Hover me
            </TooltipTrigger>
            <TooltipContent>This is a tooltip</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </ParityRow>

      <ParityRow label="Hover card" img={figmaHoverCard} imgWidth={330}>
        <HoverCard>
          <HoverCardTrigger href="#">Hover trigger</HoverCardTrigger>
          <HoverCardContent>
            <div className="flex items-center justify-center rounded-md border border-dashed p-8 text-muted-foreground">
              Remove this frame and add your content
            </div>
          </HoverCardContent>
        </HoverCard>
      </ParityRow>
    </div>
  ),
};
