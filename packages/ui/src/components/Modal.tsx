'use client';

import { ModalOverlay, Modal as RACModal } from 'react-aria-components';
import type { ModalOverlayProps } from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { cn } from '../lib/utils';

const overlayStyles = tv({
  base: 'fixed left-0 top-0 z-[99999] flex h-[--visual-viewport-height] w-full items-center justify-center bg-neutral-50/50 p-4 text-center backdrop-blur-sm entering:duration-300 entering:ease-out entering:animate-in entering:fade-in exiting:duration-300 exiting:ease-in exiting:animate-out exiting:fade-out',
});

const modalStyles = tv({
  base: 'isolate z-[999999] max-h-full w-full max-w-md rounded-md border border-offWhite bg-white bg-clip-padding backdrop-blur-lg backdrop-brightness-50 backdrop-saturate-50 entering:duration-500 entering:ease-out entering:animate-in entering:fade-in exiting:duration-500 exiting:ease-in exiting:animate-out exiting:fade-out',
});

export const Modal = ({
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

export { type ModalOverlayProps };
