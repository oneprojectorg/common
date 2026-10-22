'use client';

import { Dialog as SheetPrimitive } from '@base-ui/react/dialog';
import { useDirection } from '@base-ui/react/direction-provider';
import * as React from 'react';
import { LuX } from 'react-icons/lu';

import { cn } from '../../lib/utils';
import { Button } from './button';

type PhysicalSide = 'top' | 'right' | 'bottom' | 'left';

type SheetSide = PhysicalSide | 'inline-start' | 'inline-end';

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-overlay/15 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-sm',
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = 'right',
  showCloseButton = true,
  showOverlay = true,
  container,
  ...props
}: SheetPrimitive.Popup.Props & {
  /**
   * `inline-start` / `inline-end` follow the reading direction, as they do on
   * the other Base UI surfaces; the four physical sides are stock.
   */
  side?: SheetSide;
  showCloseButton?: boolean;
  /**
   * Renders the dimming backdrop. Set `false` for a side panel that sits
   * alongside live content the user still needs to see and scroll — pair it with
   * `modal={false}` (and usually `disablePointerDismissal`) on `Sheet`, or the
   * page behind stays inert and scroll-locked regardless.
   */
  showOverlay?: boolean;
  container?: SheetPrimitive.Portal.Props['container'];
}) {
  const physicalSide = usePhysicalSide(side);
  const isInline = physicalSide === 'left' || physicalSide === 'right';

  return (
    <SheetPortal container={container}>
      {showOverlay && <SheetOverlay />}
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={physicalSide}
        className={cn(
          'fixed z-50 flex flex-col bg-background bg-clip-padding text-foreground shadow-lg transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem] data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:border-r data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:border-l data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem]',
          // Outside the data-[side] variants so a caller's own w-*/max-w-* wins.
          isInline && 'w-7/8 sm:max-w-sm',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={
              <Button
                variant="ghost"
                className="absolute end-4 top-4 opacity-70 hover:bg-transparent hover:opacity-100"
                size="icon-sm"
              />
            }
          >
            <LuX />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  );
}

/** Every styling variant below is physical, so the logical sides resolve here. */
function usePhysicalSide(side: SheetSide): PhysicalSide {
  const isRtl = useDirection() === 'rtl';

  if (side === 'inline-start') {
    return isRtl ? 'right' : 'left';
  }

  if (side === 'inline-end') {
    return isRtl ? 'left' : 'right';
  }

  return side;
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col gap-0.5 p-6 pe-12', className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('mt-auto flex flex-col gap-2 border-t p-6', className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        'font-serif text-title font-normal text-foreground',
        className,
      )}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-base text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
