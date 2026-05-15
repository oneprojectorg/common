// Compat wrapper for @op/ui's Sheet. Pure API translation onto vanilla shadcn
// Sheet primitive.
//
// API map:
//   isOpen/onOpenChange  -> open/onOpenChange
//   isDismissable        -> showCloseButton + reason-filtered onOpenChange
//   isKeyboardDismissDisabled -> reason filter for escape-key
//   side                 -> SheetContent.side
//
//   SheetHeader  -> shadcn SheetHeader + SheetTitle. onClose accepted, ignored
//                   (vanilla SheetContent already auto-renders close X)
//   SheetBody    -> <div data-slot="sheet-body">

'use client';

import type { ReactNode } from 'react';

import {
  Sheet as ShadcnSheet,
  SheetContent as ShadcnSheetContent,
  SheetHeader as ShadcnSheetHeader,
  SheetTitle as ShadcnSheetTitle,
  SheetTrigger as ShadcnSheetTrigger,
} from './ui/sheet';

type SheetSide = 'bottom' | 'left' | 'right' | 'top';

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
  overlayClassName: _overlayClassName,
  children,
}: SheetProps) => {
  const handleOpenChange = (
    open: boolean,
    details: { reason?: string } | undefined,
  ) => {
    if (!open) {
      const reason = details?.reason;
      if (
        !isDismissable &&
        (reason === 'outside-press' || reason === 'escape-key')
      ) {
        return;
      }
      if (isKeyboardDismissDisabled && reason === 'escape-key') {
        return;
      }
    }
    onOpenChange?.(open);
  };

  return (
    <ShadcnSheet
      open={isOpen}
      defaultOpen={defaultOpen}
      onOpenChange={handleOpenChange}
    >
      <ShadcnSheetContent
        side={side}
        showCloseButton={isDismissable}
        className={className}
      >
        {children}
      </ShadcnSheetContent>
    </ShadcnSheet>
  );
};

export const SheetTrigger = ShadcnSheetTrigger;

export const SheetHeader = ({
  children,
  className,
  titleId,
  onClose: _onClose,
}: {
  children?: ReactNode;
  className?: string;
  /** Optional id forwarded to the SheetTitle for aria-labelledby referencing. */
  titleId?: string;
  onClose?: () => void;
}) => {
  return (
    <ShadcnSheetHeader className={className}>
      {children && <ShadcnSheetTitle id={titleId}>{children}</ShadcnSheetTitle>}
    </ShadcnSheetHeader>
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
    <div data-slot="sheet-body" className={className}>
      {children}
    </div>
  );
};
