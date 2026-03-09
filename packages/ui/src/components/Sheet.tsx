'use client';

import type { ReactNode } from 'react';
import {
  Dialog,
  DialogTrigger,
  Modal,
  ModalOverlay,
} from 'react-aria-components';
import type { ModalOverlayProps } from 'react-aria-components';
import { LuX } from 'react-icons/lu';

import { cn } from '../lib/utils';

const SIDE_CLASSES: Record<SheetSide, string> = {
  bottom:
    'inset-x-0 bottom-0 top-auto w-full max-h-[85svh] rounded-t-2xl entering:animate-in entering:slide-in-from-bottom exiting:animate-out exiting:slide-out-to-bottom',
  left: 'inset-y-0 left-0 right-auto h-full max-w-xs w-full rounded-none entering:animate-in entering:slide-in-from-left exiting:animate-out exiting:slide-out-to-left',
  right:
    'inset-y-0 right-0 left-auto h-full max-w-xs w-full rounded-none entering:animate-in entering:slide-in-from-right exiting:animate-out exiting:slide-out-to-right',
};

type SheetSide = 'bottom' | 'left' | 'right';

export const Sheet = ({
  side = 'bottom',
  className,
  children,
  isDismissable = true,
  ...props
}: ModalOverlayProps & {
  side?: SheetSide;
  className?: string;
  children: ReactNode;
}) => {
  return (
    <ModalOverlay
      isDismissable={isDismissable}
      className="fixed inset-0 z-[99999] bg-neutral-black/40 backdrop-blur-sm entering:animate-in entering:duration-300 entering:fade-in exiting:animate-out exiting:duration-300 exiting:fade-out"
      {...props}
    >
      <Modal
        className={cn(
          'fixed z-[999999] overflow-hidden bg-white shadow-xl outline-hidden entering:duration-300 entering:ease-out exiting:duration-200 exiting:ease-in',
          SIDE_CLASSES[side],
          className,
        )}
      >
        <Dialog className="flex max-h-[inherit] flex-col overflow-hidden outline-hidden">
          {children}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export const SheetTrigger = DialogTrigger;

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
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-md hover:bg-neutral-gray1 focus:ring-2 focus:ring-primary-teal focus:ring-offset-2 focus:outline-none"
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

export { type ModalOverlayProps as SheetProps };
