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
  base: 'fixed! inset-0! z-[99999] flex items-center justify-center bg-neutral-black/15 p-4 text-center backdrop-blur-sm entering:animate-in entering:duration-300 entering:ease-out entering:fade-in exiting:animate-out exiting:duration-300 exiting:ease-in exiting:fade-out',
});

const modalStyles = tv({
  base: 'isolate z-[999999] h-svh max-h-svh w-screen max-w-md overflow-hidden overflow-y-auto rounded-none border bg-white bg-clip-padding outline-hidden backdrop-blur-lg backdrop-brightness-50 backdrop-saturate-50 sm:h-auto sm:max-h-[calc(100svh-2rem)] sm:max-w-[32rem] sm:rounded-md entering:animate-in entering:duration-500 entering:ease-out entering:fade-in exiting:animate-out exiting:duration-500 exiting:ease-in exiting:fade-out',
});

const headerStyles = tv({
  base: 'z-30 flex w-full items-center bg-white',
  variants: {
    surface: {
      default: 'sticky top-0 min-h-16 border-b',
      flat: 'pt-6',
    },
  },
  defaultVariants: { surface: 'default' },
});

const footerStyles = tv({
  base: 'flex w-full flex-col-reverse justify-end gap-4 bg-white px-6 py-3 sm:flex-row',
  variants: {
    surface: {
      default: 'absolute bottom-0 border-t sm:sticky',
      flat: '',
    },
  },
  defaultVariants: { surface: 'default' },
});

type ModalContextType = {
  isDismissable?: boolean;
  onClose?: () => void;
  surface?: 'default' | 'flat';
};

const ModalContext = createContext<ModalContextType>({});

export const ModalHeader = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => {
  const { isDismissable, onClose, surface } = useContext(ModalContext);
  const overlayState = useContext(OverlayTriggerStateContext);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (overlayState?.close) {
      overlayState.close();
    }
  };

  return (
    <div className={headerStyles({ surface })}>
      <div className="relative flex w-full items-center justify-center">
        {isDismissable && (
          <button
            type="button"
            aria-label="Close modal"
            onClick={handleClose}
            className={cn(
              'absolute right-6 flex h-6 w-6',
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
            'w-full text-center font-serif sm:text-title-sm',
            isDismissable && 'px-14',
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
  const { surface } = useContext(ModalContext);

  return <div className={footerStyles({ surface, className })}>{children}</div>;
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

export const ModalInContext = ({
  className,
  wrapperClassName,
  overlayClassName,
  confetti,
  isDismissable,
  onOpenChange,
  surface,
  children,
  ...props
}: ModalOverlayProps & {
  className?: string;
  wrapperClassName?: string;
  overlayClassName?: string;
  confetti?: boolean;
  surface?: 'default' | 'flat';
  children: ReactNode;
}) => {
  const contextValue = {
    isDismissable,
    onClose: onOpenChange ? () => onOpenChange(false) : undefined,
    surface,
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
    surface?: 'default' | 'flat';
    children: ReactNode;
  },
) => {
  return <ModalInContext {...props} />;
};

export { type ModalOverlayProps };

// Export context for components that need to programmatically close the modal
export { ModalContext };
