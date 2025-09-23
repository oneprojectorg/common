'use client';

import {
  ReactNode,
  createContext,
  memo,
  useCallback,
  useContext,
} from 'react';
import { ModalOverlay, Modal as RACModal, OverlayTriggerStateContext } from 'react-aria-components';
import type { ModalOverlayProps } from 'react-aria-components';
import { LuX } from 'react-icons/lu';
import { tv } from 'tailwind-variants';

import { cn } from '../lib/utils';
import { Button } from './Button';
import { Confetti } from './Confetti';
import { Header1 } from './Header';

const overlayStyles = tv({
  base: 'fixed left-0 top-0 z-[99999] flex h-[--visual-viewport-height] w-full items-center justify-center bg-neutral-black/15 p-4 text-center backdrop-blur-sm entering:duration-300 entering:ease-out entering:animate-in entering:fade-in exiting:duration-300 exiting:ease-in exiting:animate-out exiting:fade-out',
});

const modalStyles = tv({
  base: 'isolate z-[999999] h-svh max-h-svh w-screen max-w-md overflow-hidden overflow-y-auto rounded-none border border-offWhite bg-white bg-clip-padding backdrop-blur-lg backdrop-brightness-50 backdrop-saturate-50 entering:duration-500 entering:ease-out entering:animate-in entering:fade-in exiting:duration-500 exiting:ease-in exiting:animate-out exiting:fade-out sm:h-auto sm:max-h-[calc(100svh-2rem)] sm:max-w-[29rem] sm:rounded-md',
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
    <div className="sticky top-0 z-30 flex min-h-16 w-full items-center border-b border-neutral-gray1 bg-white">
      <div className="relative flex w-full items-center justify-center">
        {isDismissable && (
          <button
            type="button"
            aria-label="Close modal"
            onClick={handleClose}
            className={cn(
              'absolute left-6 flex h-6 w-6',
              'items-center justify-center',
              'rounded-sm hover:bg-neutral-gray1 focus:outline-none focus:ring-2 focus:ring-primary-teal focus:ring-offset-2',
              'text-neutral-charcoal',
            )}
          >
            <LuX className="h-6 w-6 stroke-1" aria-hidden="true" />
          </button>
        )}
        <Header1
          className={cn(
            'w-full text-center font-serif sm:text-title-sm',
            className,
          )}
        >
          {children}
        </Header1>
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
        'absolute bottom-0 flex w-full flex-col-reverse justify-end gap-4 border-t border-neutral-gray1 bg-white px-6 py-3 sm:sticky sm:flex-row',
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
      >
        {confetti && <Confetti />}
        <div className={wrapperClassName}>
          <RACModal className={modalStyles({ className })}>{children}</RACModal>
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
  },
) => {
  return <ModalInContext {...props} />;
};

export { type ModalOverlayProps };

// Export context for components that need to programmatically close the modal
export { ModalContext };
