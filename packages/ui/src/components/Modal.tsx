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
  base: 'inset-0! p-4 entering:duration-300 entering:ease-out entering:animate-in entering:fade-in exiting:duration-300 exiting:ease-in exiting:animate-out exiting:fade-out fixed! z-[99999] flex items-center justify-center bg-neutral-black/15 text-center backdrop-blur-sm',
});

const modalStyles = tv({
  base: 'max-w-md backdrop-blur-lg entering:duration-500 entering:ease-out entering:animate-in entering:fade-in exiting:duration-500 exiting:ease-in exiting:animate-out exiting:fade-out sm:h-auto sm:max-h-[calc(100svh-2rem)] sm:max-w-[32rem] sm:rounded-md isolate z-[999999] h-svh max-h-svh w-screen overflow-hidden overflow-y-auto rounded-none border border-neutral-gray1 bg-white bg-clip-padding backdrop-brightness-50 backdrop-saturate-50 focus-visible:outline-hidden',
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
    <div className="top-0 min-h-16 sticky z-30 flex w-full items-center border-b border-neutral-gray1 bg-white">
      <div className="relative flex w-full items-center justify-center">
        {isDismissable && (
          <button
            type="button"
            aria-label="Close modal"
            onClick={handleClose}
            className={cn(
              'left-6 h-6 w-6 absolute flex',
              'items-center justify-center',
              'rounded-sm hover:bg-neutral-gray1 focus:ring-2 focus:ring-primary-teal focus:ring-offset-2 focus:outline-hidden',
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
        'gap-2 p-6 flex w-full flex-col text-left focus-visible:outline-0',
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
        'bottom-0 gap-4 px-6 py-3 sm:sticky sm:flex-row absolute flex w-full flex-col-reverse justify-end border-t border-neutral-gray1 bg-white',
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
          'bottom-0 sticky',
          'flex w-full items-center justify-between',
          'px-6 py-3',
          'border-t border-neutral-gray1 bg-white',
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
