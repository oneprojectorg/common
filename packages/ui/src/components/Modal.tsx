'use client';

import { ReactNode } from 'react';
import { ModalOverlay, Modal as RACModal } from 'react-aria-components';
import type { ModalOverlayProps } from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { cn } from '../lib/utils';
import { Confetti } from './Confetti';
import { Header1 } from './Header';

const overlayStyles = tv({
  base: 'fixed left-0 top-0 z-[99999] flex h-[--visual-viewport-height] w-full items-center justify-center bg-neutral-black/15 p-4 text-center backdrop-blur-sm entering:duration-300 entering:ease-out entering:animate-in entering:fade-in exiting:duration-300 exiting:ease-in exiting:animate-out exiting:fade-out',
});

const modalStyles = tv({
  base: 'isolate z-[999999] max-h-full w-full max-w-md overflow-hidden rounded-none border border-offWhite bg-white bg-clip-padding backdrop-blur-lg backdrop-brightness-50 backdrop-saturate-50 entering:duration-500 entering:ease-out entering:animate-in entering:fade-in exiting:duration-500 exiting:ease-in exiting:animate-out exiting:fade-out sm:h-auto sm:max-h-[calc(100svh-2rem)] sm:max-w-[26rem] sm:rounded-md',
});

export const ModalHeader = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => {
  return (
    <div className="sticky top-0 z-30 w-full border-b border-neutral-gray1 bg-white p-6 text-left">
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
        'sticky bottom-0 flex w-full justify-end gap-4 border-t border-neutral-gray1 bg-white px-6 py-3',
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
  confetti,
  ...props
}: ModalOverlayProps & {
  className?: string;
  wrapperClassName?: string;
  overlayClassName?: string;
  confetti?: boolean;
}) => {
  return (
    <ModalOverlay
      {...props}
      className={overlayStyles({
        className: cn(overlayClassName),
      })}
    >
      {confetti && <Confetti />}
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
    confetti?: boolean;
  },
) => {
  return <ModalInContext {...props} />;
};

export { type ModalOverlayProps };
