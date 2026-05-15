// Compat wrapper for @op/ui's Sheet. Maps legacy RAC Sheet API onto shadcn
// base-ui Dialog (used for side-anchored sheets).

'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import type { ReactNode } from 'react';
import { LuX } from 'react-icons/lu';

import { cn } from '../lib/utils';

type SheetSide = 'bottom' | 'left' | 'right';

const SIDE_CLASSES: Record<SheetSide, string> = {
  bottom:
    'inset-x-0 bottom-0 top-auto w-full max-h-[85svh] rounded-t-2xl data-starting-style:translate-y-full data-ending-style:translate-y-full',
  left: 'inset-y-0 left-0 right-auto h-full max-w-xs w-full rounded-none data-starting-style:-translate-x-full data-ending-style:-translate-x-full',
  right:
    'inset-y-0 right-0 left-auto h-full max-w-xs w-full rounded-none data-starting-style:translate-x-full data-ending-style:translate-x-full',
};

export interface SheetProps {
  isOpen?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  isDismissable?: boolean;
  isKeyboardDismissDisabled?: boolean;
  side?: SheetSide;
  className?: string;
  overlayClassName?: string;
  children: ReactNode;
}

export const Sheet = ({
  isOpen,
  defaultOpen,
  onOpenChange,
  isDismissable = true,
  isKeyboardDismissDisabled,
  side = 'bottom',
  className,
  overlayClassName,
  children,
}: SheetProps) => {
  const handleOpenChange = (
    open: boolean,
    details: { reason?: string } | undefined,
  ) => {
    if (!open) {
      const reason = details?.reason;
      if (!isDismissable && (reason === 'outside-press' || reason === 'escape-key')) {
        return;
      }
      if (isKeyboardDismissDisabled && reason === 'escape-key') {
        return;
      }
    }
    onOpenChange?.(open);
  };

  return (
    <DialogPrimitive.Root
      open={isOpen}
      defaultOpen={defaultOpen}
      onOpenChange={handleOpenChange}
      disablePointerDismissal={!isDismissable}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          data-slot="sheet-overlay"
          className={cn(
            'fixed inset-0 z-[99999] bg-neutral-black/40 backdrop-blur-sm duration-200 ease-out data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0',
            overlayClassName,
          )}
        />
        <DialogPrimitive.Popup
          data-slot="sheet-content"
          data-side={side}
          className={cn(
            'fixed z-[999999] overflow-hidden bg-white shadow-xl outline-none transition duration-300 ease-out',
            SIDE_CLASSES[side],
            className,
          )}
        >
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export const SheetTrigger = DialogPrimitive.Trigger;

export const SheetHeader = ({
  children,
  className,
  onClose,
}: {
  children?: ReactNode;
  className?: string;
  onClose?: () => void;
}) => {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-between border-b px-4 py-3',
        className,
      )}
    >
      {children && <span className="font-serif text-title-sm">{children}</span>}
      {onClose && (
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="ml-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg outline-none hover:bg-neutral-gray1 focus-visible:ring-2 focus-visible:ring-primary-teal focus-visible:ring-offset-2"
        >
          <LuX className="size-4" />
        </button>
      )}
    </div>
  );
};

export const SheetBody = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn('min-h-0 flex-1 overflow-y-auto', className)}>
      {children}
    </div>
  );
};
