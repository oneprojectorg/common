// Compat wrapper for @op/ui's Modal. Maps the legacy RAC Modal+ModalHeader+
// ModalBody+ModalFooter+ModalStepper API onto shadcn's base-ui Dialog
// primitive. Visual styling matches @op/ui Modal so the 52 consumer sites
// can swap import paths without JSX restructure.
//
// Consumers that wrapped Modal inside RAC `<DialogTrigger>` must migrate to
// controlled state (isOpen + onOpenChange + useState) — no compat for that.

'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import {
  type ReactNode,
  createContext,
  memo,
  useCallback,
  useContext,
} from 'react';
import { LuX } from 'react-icons/lu';

import { Button } from './Button';
import { cn } from '../lib/utils';

type Surface = 'default' | 'flat';

type ModalContextValue = {
  isDismissable?: boolean;
  surface?: Surface;
};

const ModalContext = createContext<ModalContextValue>({});

export interface ModalProps {
  isOpen?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  isDismissable?: boolean;
  isKeyboardDismissDisabled?: boolean;
  surface?: Surface;
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
  surface = 'default',
  className,
  overlayClassName,
  wrapperClassName,
  confetti: _confetti,
  children,
}: ModalProps) => {
  const handleOpenChange = (
    open: boolean,
    details: { reason?: string } | undefined,
  ) => {
    if (!open) {
      const reason = details?.reason;
      if (isDismissable === false && (reason === 'outside-press' || reason === 'escape-key')) {
        return;
      }
      if (isKeyboardDismissDisabled && reason === 'escape-key') {
        return;
      }
    }
    onOpenChange?.(open);
  };

  return (
    <ModalContext.Provider value={{ isDismissable, surface }}>
      <DialogPrimitive.Root
        open={isOpen}
        defaultOpen={defaultOpen}
        onOpenChange={handleOpenChange}
        disablePointerDismissal={isDismissable === false}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop
            data-slot="dialog-overlay"
            className={cn(
              'fixed inset-0 z-[99999] flex items-center justify-center bg-neutral-black/15 p-4 text-center backdrop-blur-sm duration-200 ease-out data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0',
              overlayClassName,
            )}
          />
          <div
            className={cn(
              'fixed inset-0 z-[999999] flex items-center justify-center p-4',
              wrapperClassName,
            )}
          >
            <DialogPrimitive.Popup
              data-slot="dialog-content"
              {...(isKeyboardDismissDisabled
                ? { closeOnEscape: false }
                : {})}
              className={cn(
                'isolate h-svh max-h-svh w-screen max-w-md overflow-hidden overflow-y-auto rounded-none border bg-white bg-clip-padding outline-none duration-200 ease-out data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 sm:h-auto sm:max-h-[calc(100svh-2rem)] sm:max-w-[32rem] sm:rounded-lg',
                className,
              )}
            >
              {children}
            </DialogPrimitive.Popup>
          </div>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </ModalContext.Provider>
  );
};

export const ModalHeader = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => {
  const { isDismissable, surface } = useContext(ModalContext);

  return (
    <div
      className={cn(
        'z-30 flex w-full items-center bg-white',
        surface === 'flat'
          ? 'pt-6'
          : 'sticky top-0 min-h-16 border-b',
      )}
    >
      <div className="relative flex w-full items-center justify-center">
        {isDismissable && (
          <DialogPrimitive.Close
            aria-label="Close modal"
            className={cn(
              'absolute right-6 flex h-6 w-6',
              'items-center justify-center',
              'cursor-pointer rounded-md outline-none hover:bg-neutral-gray1 focus-visible:ring-2 focus-visible:ring-primary-teal focus-visible:ring-offset-2',
              'text-neutral-charcoal',
            )}
          >
            <LuX className="h-6 w-6" aria-hidden="true" />
          </DialogPrimitive.Close>
        )}
        <DialogPrimitive.Title
          className={cn(
            'w-full text-center font-serif sm:text-title-sm',
            isDismissable && 'px-14',
            className,
          )}
        >
          {children}
        </DialogPrimitive.Title>
      </div>
    </div>
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
    <div
      className={cn(
        'flex w-full flex-col gap-2 p-6 text-left focus-visible:outline-0',
        className,
      )}
    >
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
  const { surface } = useContext(ModalContext);

  return (
    <div
      className={cn(
        'flex w-full flex-col-reverse justify-end gap-4 bg-white px-6 py-3 sm:flex-row',
        surface === 'flat'
          ? ''
          : 'absolute bottom-0 border-t sm:sticky',
        className,
      )}
    >
      {children}
    </div>
  );
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
      <footer
        className={cn(
          'sticky bottom-0',
          'flex w-full items-center justify-between',
          'px-6 py-3',
          'border-t bg-white',
        )}
      >
        <span className="flex-1">
          {!isFirstStep && (
            <Button color="secondary" onPress={handlePrevious}>
              Back
            </Button>
          )}
        </span>
        <span className="flex-1 text-center text-sm text-neutral-gray4">
          Step {currentStep} of {totalSteps}
        </span>
        <div className="flex flex-1 justify-end">
          <Button type={isLastStep ? 'submit' : 'button'} onPress={handleNext}>
            {isLastStep ? 'Finish' : 'Next'}
          </Button>
        </div>
      </footer>
    );
  },
);

ModalStepper.displayName = 'ModalStepper';

export { ModalContext };
