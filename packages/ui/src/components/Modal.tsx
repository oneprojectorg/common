'use client';

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { ModalOverlay, Modal as RACModal } from 'react-aria-components';
import type { ModalOverlayProps } from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { cn } from '../lib/utils';
import { Header1 } from './Header';

// interface ModalContextType {
// isOpen: boolean;
// openModal: () => void;
// closeModal: () => void;
// }

// const ModalContext = createContext<ModalContextType | undefined>(undefined);

// export const useModal = (): ModalContextType => {
// const context = useContext(ModalContext);
// if (!context) {
// throw new Error('useModal must be used within a ModalProvider');
// }
// return context;
// };

// export const ModalProvider = ({ children }: { children: ReactNode }) => {
// const [isOpen, setIsOpen] = useState(false);

// const openModal = useCallback(() => setIsOpen(true), []);
// const closeModal = useCallback(() => setIsOpen(false), []);

// const value = useMemo(
// () => ({ isOpen, openModal, closeModal }),
// [isOpen, openModal, closeModal],
// );

// return (
// <ModalContext.Provider value={value}>{children}</ModalContext.Provider>
// );
// };

const overlayStyles = tv({
  base: 'fixed left-0 top-0 z-[99999] flex h-[--visual-viewport-height] w-full items-center justify-center bg-neutral-50/50 p-4 text-center backdrop-blur-sm entering:duration-300 entering:ease-out entering:animate-in entering:fade-in exiting:duration-300 exiting:ease-in exiting:animate-out exiting:fade-out',
});

const modalStyles = tv({
  base: 'isolate z-[999999] max-h-full w-full max-w-md rounded-md border border-offWhite bg-white bg-clip-padding backdrop-blur-lg backdrop-brightness-50 backdrop-saturate-50 entering:duration-500 entering:ease-out entering:animate-in entering:fade-in exiting:duration-500 exiting:ease-in exiting:animate-out exiting:fade-out',
});

export const ModalHeader = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => {
  return (
    <div className="w-full border-b border-neutral-gray1 p-6 text-left">
      <Header1 className={cn('font-serif sm:text-title-sm', className)}>
        {children}
      </Header1>
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
    <div className={cn('flex w-full flex-col gap-2 p-6 text-left', className)}>
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
        'flex w-full justify-end gap-4 border-t border-neutral-gray1 px-6 py-3',
        className,
      )}
    >
      {children}
    </div>
  );
};

export const ModalInContext = ({
  className,
  wrapperClassName,
  overlayClassName,
  ...props
}: ModalOverlayProps & {
  className?: string;
  wrapperClassName?: string;
  overlayClassName?: string;
}) => {
  return (
    <ModalOverlay
      {...props}
      className={overlayStyles({
        className: cn(overlayClassName),
      })}
    >
      <div className={wrapperClassName}>
        <RACModal {...props} className={modalStyles({ className })} />
      </div>
    </ModalOverlay>
  );
};

export const Modal = (
  props: ModalOverlayProps & {
    className?: string;
    wrapperClassName?: string;
    overlayClassName?: string;
  },
) => {
  return <ModalInContext {...props} />;
};

export { type ModalOverlayProps };
