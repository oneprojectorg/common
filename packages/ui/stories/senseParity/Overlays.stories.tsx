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
import { useState } from 'react';

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
// The dialog/alert-dialog/sheet/drawer rows show the overlay twice: "preview"
// renders the real component permanently open with its panel restyled into
// static flow (no backdrop, no fixed positioning) so the bare panel sits next
// to the Figma export, and "interactive" is the trigger-driven component.
// Popover, tooltip, and hover-card popups can't render unanchored, so those
// rows are interactive-only.

const meta: Meta = {
  title: 'Sense Comparison/Figma Parity/Overlays',
  parameters: { layout: 'fullscreen' },
  decorators: [withDesignScale],
};

export default meta;

type Story = StoryObj;

const dialogBody = (
  <>
    <DialogHeader>
      <DialogTitle>Dialog title</DialogTitle>
      <DialogDescription>This is a dialog description.</DialogDescription>
    </DialogHeader>
    <div className="px-6 pt-8 pb-10">
      <div className="flex items-center justify-center rounded-md border border-dashed bg-muted p-5.5 text-center text-sm leading-none text-muted-foreground">
        Remove this frame and add your content
      </div>
    </div>
    <DialogFooter>
      <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
      <Button>Save changes</Button>
    </DialogFooter>
  </>
);

const alertDialogBody = (
  <>
    <AlertDialogHeader>
      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone. This will permanently delete your account
        from our servers.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction>Continue</AlertDialogAction>
    </AlertDialogFooter>
  </>
);

const sheetBody = (
  <>
    <SheetHeader>
      <SheetTitle>Title Text</SheetTitle>
      <SheetDescription>This is a sheet description.</SheetDescription>
    </SheetHeader>
    <div className="flex-1 px-6 pb-6">
      <div className="flex h-full items-center justify-center rounded-md border border-dashed bg-muted p-5.5 text-center text-sm text-muted-foreground">
        Remove this frame and add your content
      </div>
    </div>
    <SheetFooter>
      <Button>Button</Button>
      <Button variant="outline">Button</Button>
    </SheetFooter>
  </>
);

const drawerBody = (
  <>
    <DrawerHeader>
      <DrawerTitle>Title Text</DrawerTitle>
      <DrawerDescription>This is a drawer description.</DrawerDescription>
    </DrawerHeader>
    <div className="px-6">
      <div className="flex items-center justify-center rounded-md border border-dashed bg-muted p-5.5 text-center text-sm text-muted-foreground">
        Remove this frame and add your content
      </div>
    </div>
    <DrawerFooter>
      <Button>Submit</Button>
      <DrawerClose render={<Button variant="outline" />}>Cancel</DrawerClose>
    </DrawerFooter>
  </>
);

const popoverBody = (
  <>
    <PopoverHeader>
      <PopoverTitle>Dimensions</PopoverTitle>
      <PopoverDescription>Set the dimensions for the layer.</PopoverDescription>
    </PopoverHeader>
    <div className="flex items-center justify-center rounded-md border border-dashed bg-muted p-5.5 text-center text-sm text-muted-foreground">
      Remove this frame and add your content
    </div>
  </>
);

const hoverCardBody = (
  <div className="flex items-center justify-center rounded-md border border-dashed bg-muted p-5.5 text-center text-sm text-muted-foreground">
    Remove this frame and add your content
  </div>
);

// Restyles a portaled panel into static flow: twMerge drops the popup's
// `fixed` and translate centering in favour of these.
const staticPanel = 'sense relative top-0 left-0 translate-none';

export const Overlays: Story = {
  name: 'Overlays',
  render: () => (
    <div className="flex flex-col gap-10 p-8">
      <ParityGridHeader />

      <ParityRow label="Dialog" img={figmaDialog} imgWidth={425}>
        <OverlayModes
          preview={(container) => (
            <Dialog open modal={false}>
              <DialogContent
                container={container}
                initialFocus={false}
                className={`${staticPanel} mx-auto my-10`}
              >
                {dialogBody}
              </DialogContent>
            </Dialog>
          )}
        >
          <Dialog>
            <DialogTrigger render={<Button variant="outline" />}>
              Open dialog
            </DialogTrigger>
            <DialogContent className="sense">{dialogBody}</DialogContent>
          </Dialog>
        </OverlayModes>
      </ParityRow>

      <ParityRow label="Alert dialog" img={figmaAlertDialog} imgWidth={384}>
        <OverlayModes
          preview={(container) => (
            // AlertDialog's root hard-forces modal (scroll lock + inert page),
            // so the always-open preview uses a plain Dialog root — base-ui's
            // AlertDialog.Popup is DialogPopup and shares the dialog context.
            <Dialog open modal={false}>
              <AlertDialogContent
                container={container}
                initialFocus={false}
                className={`${staticPanel} mx-auto my-10`}
              >
                {alertDialogBody}
              </AlertDialogContent>
            </Dialog>
          )}
        >
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="outline" />}>
              Open alert dialog
            </AlertDialogTrigger>
            <AlertDialogContent className="sense">
              {alertDialogBody}
            </AlertDialogContent>
          </AlertDialog>
        </OverlayModes>
      </ParityRow>

      <ParityRow label="Sheet" img={figmaSheet} imgWidth={592}>
        <OverlayModes
          preview={(container) => (
            <Sheet open modal={false}>
              <SheetContent
                side="right"
                container={container}
                initialFocus={false}
                className={`${staticPanel} ml-auto h-[480px]!`}
              >
                {sheetBody}
              </SheetContent>
            </Sheet>
          )}
        >
          <Sheet>
            <SheetTrigger render={<Button variant="outline" />}>
              Open sheet
            </SheetTrigger>
            <SheetContent side="right" className="sense">
              {sheetBody}
            </SheetContent>
          </Sheet>
        </OverlayModes>
      </ParityRow>

      <ParityRow label="Drawer" img={figmaDrawer} imgWidth={424}>
        <OverlayModes
          preview={(container) => (
            <Drawer open modal={false}>
              <DrawerContent
                container={container}
                className={`${staticPanel} mt-16! h-auto! max-h-full transform-none!`}
              >
                {drawerBody}
              </DrawerContent>
            </Drawer>
          )}
        >
          <Drawer>
            <DrawerTrigger render={<Button variant="outline" />}>
              Open drawer
            </DrawerTrigger>
            <DrawerContent className="sense">{drawerBody}</DrawerContent>
          </Drawer>
        </OverlayModes>
      </ParityRow>

      <ParityRow label="Popover" img={figmaPopover} imgWidth={330}>
        <Popover>
          <PopoverTrigger render={<Button variant="outline" />}>
            Open popover
          </PopoverTrigger>
          <PopoverContent className="sense">{popoverBody}</PopoverContent>
        </Popover>
      </ParityRow>

      <ParityRow label="Tooltip" img={figmaTooltip} imgWidth={120}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger render={<Button variant="outline" />}>
              Hover me
            </TooltipTrigger>
            <TooltipContent className="sense">This is a tooltip</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </ParityRow>

      <ParityRow label="Hover card" img={figmaHoverCard} imgWidth={330}>
        <HoverCard>
          <HoverCardTrigger
            href="#"
            className="text-sm font-strong text-primary hover:underline"
          >
            Hover trigger
          </HoverCardTrigger>
          <HoverCardContent className="sense">{hoverCardBody}</HoverCardContent>
        </HoverCard>
      </ParityRow>
    </div>
  ),
};

// Shows an overlay's bare open panel in normal flow ("preview") with the
// trigger-driven version below ("interactive"). The panel is portaled into
// the wrapper via the container prop; backdrops are hidden and positioning
// is neutralised by the classes above.
function OverlayModes({
  preview,
  children,
}: {
  preview: (container: HTMLDivElement) => React.ReactNode;
  children: React.ReactNode;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  return (
    <div className="flex w-full flex-col gap-3">
      <p className="font-mono text-xs text-neutral-gray4 uppercase">Preview</p>
      <div
        ref={setContainer}
        className="relative w-full overflow-hidden rounded-lg border border-neutral-gray1 bg-neutral-gray1/40 [&_[data-slot$=overlay]]:hidden"
      >
        {container && preview(container)}
      </div>
      <p className="pt-2 font-mono text-xs text-neutral-gray4 uppercase">
        Interactive
      </p>
      <div>{children}</div>
    </div>
  );
}
