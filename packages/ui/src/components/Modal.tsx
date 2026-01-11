'use client';

import { ReactNode, createContext, memo, useCallback, useContext } from 'react';
import {
  Dialog,
  Heading,
  ModalOverlay,
  OverlayTriggerStateContext,
  Modal as RACModal,
} from 'react-aria-components';
import type { ModalOverlayProps } from 'react-aria-components';
import { LuX } from 'react-icons/lu';
import { tv } from 'tailwind-variants';

import { cn } from '../lib/utils';
import { Button } from './Button';
import { Confetti } from './Confetti';

const overlayStyles = tv({
  base: 'inset-0! entering:duration-300 entering:ease-out entering:animate-in entering:fade-in exiting:duration-300 exiting:ease-in exiting:animate-out exiting:fade-out fixed! bg-neutral-black/15 z-[99999] flex items-center justify-center p-4 text-center backdrop-blur-sm',
});

const modalStyles = tv({
  base: 'entering:duration-500 entering:ease-out entering:animate-in entering:fade-in exiting:duration-500 exiting:ease-in exiting:animate-out exiting:fade-out border-neutral-gray1 focus-visible:outline-hidden isolate z-[999999] h-svh max-h-svh w-screen max-w-md overflow-hidden overflow-y-auto rounded-none border bg-white bg-clip-padding backdrop-blur-lg backdrop-brightness-50 backdrop-saturate-50 sm:h-auto sm:max-h-[calc(100svh-2rem)] sm:max-w-[32rem] sm:rounded-md',
});

type ModalContextType = {
  isDismissable?: boolean;
  onClose?: () => void;
};

const ModalContext = createContext<ModalContextType>({});

export const ModalHeader = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => {
  const { isDismissable, onClose } = useContext(ModalContext);
  const overlayState = useContext(OverlayTriggerStateContext);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (overlayState?.close) {
      overlayState.close();
    }
  };

  return (
    <div className="border-neutral-gray1 sticky top-0 z-30 flex min-h-16 w-full items-center border-b bg-white">
      <div className="relative flex w-full items-center justify-center">
        {isDismissable && (
          <button
            type="button"
            aria-label="Close modal"
            onClick={handleClose}
            className={cn(
              'absolute left-6 flex h-6 w-6',
              'items-center justify-center',
              'hover:bg-neutral-gray1 focus:ring-primary-teal focus:outline-hidden rounded-sm focus:ring-2 focus:ring-offset-2',
              'text-neutral-charcoal',
            )}
          >
            <LuX className="h-6 w-6" aria-hidden="true" />
          </button>
        )}
        <Heading
          slot="title"
          className={cn(
            'sm:text-title-sm w-full text-center font-serif',
            className,
          )}
        >
          {children}
        </Heading>
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
  return (
    <div
      className={cn(
        'border-neutral-gray1 absolute bottom-0 flex w-full flex-col-reverse justify-end gap-4 border-t bg-white px-6 py-3 sm:sticky sm:flex-row',
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
        // run validation to be sure we CAN move to the next step
        onNext(); // Parent component handles step advancement if validation passes
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
          'border-neutral-gray1 border-t bg-white',
        )}
      >
        <span className="flex-1">
          {!isFirstStep && (
            <Button color="secondary" onPress={handlePrevious}>
              Back
            </Button>
          )}
        </span>
        <span className="text-neutral-gray4 flex-1 text-center text-sm">
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

export const ModalInContext = ({
  className,
  wrapperClassName,
  overlayClassName,
  confetti,
  isDismissable,
  onOpenChange,
  children,
  ...props
}: ModalOverlayProps & {
  className?: string;
  wrapperClassName?: string;
  overlayClassName?: string;
  confetti?: boolean;
  children: ReactNode;
}) => {
  const contextValue = {
    isDismissable,
    onClose: onOpenChange ? () => onOpenChange(false) : undefined,
  };

  return (
    <ModalContext.Provider value={contextValue}>
      <ModalOverlay
        {...props}
        isDismissable={isDismissable}
        onOpenChange={onOpenChange}
        className={overlayStyles({
          className: cn(overlayClassName),
        })}
        style={{ zIndex: 99999, position: 'fixed', inset: 0 }}
      >
        {confetti && <Confetti />}
        <div className={wrapperClassName}>
          <RACModal>
            <Dialog className={modalStyles({ className })}>{children}</Dialog>
          </RACModal>
        </div>
      </ModalOverlay>
    </ModalContext.Provider>
  );
};

export const Modal = (
  props: ModalOverlayProps & {
    className?: string;
    wrapperClassName?: string;
    overlayClassName?: string;
    confetti?: boolean;
    children: ReactNode;
  },
) => {
  return <ModalInContext {...props} />;
};

export { type ModalOverlayProps };

// Export context for components that need to programmatically close the modal
export { ModalContext };
