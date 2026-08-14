'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import * as React from 'react';
import { LuX } from 'react-icons/lu';

import { cn } from '../../lib/utils';
import { Confetti } from '../Confetti';
import { Button } from './button';

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 isolate z-50 bg-overlay/15 duration-100 data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0 supports-backdrop-filter:backdrop-blur-sm',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Below `sm` the popup is a full-viewport sheet — `DialogHeader` pins to the top,
 * `DialogFooter` pins to the bottom, and whatever sits between them is the
 * scrolling body. At `sm` and up it is the centred card. Two consequences for
 * callers:
 *
 * - **Prefix layout overrides with `sm:`.** An unprefixed `max-h-*`, `max-w-*` or
 *   `rounded-*` shrinks the mobile sheet back into a floating card.
 * - **Give the body `flex-1 min-h-0`** if the popup should not scroll as a whole
 *   (i.e. you pass `overflow-hidden`). Without `flex-1` the body won't absorb the
 *   free space and the pinned footer leaves a gap under short content.
 *
 * One layout model — `flex flex-col` — at every breakpoint, because the footer can
 * only reach the bottom of a short mobile sheet via `mt-auto`.
 */
function DialogContent({
  className,
  children,
  showCloseButton = true,
  container,
  confetti = false,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
  container?: DialogPrimitive.Portal.Props['container'];
  /**
   * Burst confetti behind the card while the dialog is open. Rendered inside
   * the backdrop so it fills the screen (not clipped to the card) and fades
   * with the backdrop on close. Replays on each open (the backdrop remounts).
   */
  confetti?: boolean;
}) {
  return (
    <DialogPortal container={container}>
      <DialogOverlay>
        {/* Inside the backdrop so it inherits the open/close transition — on an
            early close the confetti fades out with the backdrop instead of
            being cut. pointer-events-none keeps click-to-dismiss working. */}
        {confetti ? (
          <div className="pointer-events-none absolute inset-0">
            <Confetti />
          </div>
        ) : null}
      </DialogOverlay>
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          // Mobile-first: a full-viewport sheet. `inset-0` (not `h-dvh`) so a
          // caller can re-anchor it with `top-auto bottom-0` and a `max-h-*`.
          // No `translate` here on purpose — a non-`none` `translate` would make
          // this a containing block and break the `fixed` close button below.
          'fixed inset-0 z-50 flex w-full flex-col overflow-y-auto bg-popover text-popover-foreground duration-100 outline-none data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[calc(100dvh-2rem)] sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border sm:data-closed:zoom-out-95 sm:data-open:zoom-in-95',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              // `fixed` on mobile: the popup is the scroll container, so an
              // `absolute` button would scroll away with the body. `z-20` clears
              // the sticky header.
              <Button
                variant="ghost"
                className="fixed end-4 top-4 z-20 opacity-70 hover:bg-transparent hover:opacity-100 sm:absolute"
                size="icon-sm"
              />
            }
          >
            <LuX />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        // Sticky (mobile) keeps it at the top of the screen when the popup itself
        // is the scroll container; `sm:static` restores the desktop card, where
        // the header scrolls with the content.
        'sticky top-0 z-10 flex flex-col gap-2 border-b bg-popover px-6 pe-12 pt-6 pb-4 sm:static',
        className,
      )}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        // `mt-auto` pins it to the bottom of a short mobile sheet; `sticky` keeps
        // it there once the body is tall enough to scroll. Both are needed.
        'sticky bottom-0 z-10 mt-auto flex flex-col-reverse gap-2 border-t bg-muted px-6 py-4 sm:static sm:mt-0 sm:flex-row sm:justify-end sm:rounded-b-xl',
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('font-serif text-title font-normal', className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        'text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
