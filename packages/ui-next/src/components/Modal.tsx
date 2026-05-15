// Compat wrapper for @op/ui's Modal. Pure API translation onto vanilla shadcn
// Dialog primitive (no style overrides beyond layout shims needed to bridge the
// legacy ModalHeader/ModalBody/ModalFooter slot API).
//
// API map:
//   isOpen/onOpenChange  -> open/onOpenChange
//   isDismissable        -> showCloseButton + reason-filtered onOpenChange
//   isKeyboardDismissDisabled -> reason filter for escape-key
//   surface              -> accepted, ignored (no vanilla shadcn equivalent)
//   confetti             -> accepted, ignored
//   className            -> forwarded to DialogContent (Popup)
//   overlayClassName     -> forwarded to DialogOverlay (Backdrop)
//   wrapperClassName     -> accepted, ignored (vanilla shadcn has no wrapper)
//
//   ModalHeader  -> DialogHeader + DialogTitle
//   ModalBody    -> <div data-slot="modal-body">
//   ModalFooter  -> DialogFooter
//   ModalStepper -> custom (no shadcn equivalent)

'use client';

import { type ReactNode, memo, useCallback } from 'react';

import { cn } from '../lib/utils';
import { Button } from './Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

export interface ModalProps {
  isOpen?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  isDismissable?: boolean;
  isKeyboardDismissDisabled?: boolean;
  surface?: 'default' | 'flat';
  className?: string;
  overlayClassName?: string;
  wrapperClassName?: string;
  confetti?: boolean;
  children: ReactNode;
}

export const Modal = ({
  isOpen,
  defaultOpen,
  onOpenChange,
  isDismissable,
  isKeyboardDismissDisabled,
  surface: _surface,
  className,
  overlayClassName: _overlayClassName,
  wrapperClassName: _wrapperClassName,
  confetti: _confetti,
  children,
}: ModalProps) => {
  const handleOpenChange = (
    open: boolean,
    details: { reason?: string } | undefined,
  ) => {
    if (!open) {
      const reason = details?.reason;
      if (
        isDismissable === false &&
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
    <Dialog
      open={isOpen}
      defaultOpen={defaultOpen}
      onOpenChange={handleOpenChange}
    >
      <DialogContent
        className={className}
        showCloseButton={isDismissable !== false}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
};

export const ModalHeader = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => {
  return (
    <DialogHeader className={className}>
      <DialogTitle>{children}</DialogTitle>
    </DialogHeader>
  );
};

export const ModalBody = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => {
  return (
    <div data-slot="modal-body" className={className}>
      {children}
    </div>
  );
};

export const ModalFooter = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => {
  return <DialogFooter className={className}>{children}</DialogFooter>;
};

export const ModalStepper = memo(
  ({
    currentStep,
    totalSteps,
    onNext,
    onPrevious,
    onFinish,
  }: {
    currentStep: number;
    totalSteps: number;
    onNext: () => boolean | undefined;
    onPrevious: () => void;
    onFinish?: () => void;
  }) => {
    const isFirstStep = currentStep === 1;
    const isLastStep = currentStep === totalSteps;

    const handleNext = useCallback(() => {
      if (currentStep < totalSteps) {
        onNext();
      } else if (currentStep === totalSteps && onFinish) {
        onFinish();
      }
    }, [currentStep, totalSteps, onNext, onFinish]);

    const handlePrevious = useCallback(() => {
      if (currentStep > 1) {
        onPrevious();
      }
    }, [currentStep, onPrevious]);

    return (
      <DialogFooter className={cn('items-center sm:justify-between')}>
        <span className="flex-1">
          {!isFirstStep && (
            <Button color="secondary" onPress={handlePrevious}>
              Back
            </Button>
          )}
        </span>
        <span className="text-muted-foreground flex-1 text-center text-sm">
          Step {currentStep} of {totalSteps}
        </span>
        <div className="flex flex-1 justify-end">
          <Button type={isLastStep ? 'submit' : 'button'} onPress={handleNext}>
            {isLastStep ? 'Finish' : 'Next'}
          </Button>
        </div>
      </DialogFooter>
    );
  },
);

ModalStepper.displayName = 'ModalStepper';
