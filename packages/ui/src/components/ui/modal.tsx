'use client';

import {
  ModalOverlay,
  ModalOverlayProps,
  Modal as RACModal,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

const overlayStyles = tv({
  base: 'absolute top-0 left-0 isolate z-20 h-(--page-height) w-full bg-black/[50%] backdrop-blur-lg',
  variants: {
    isEntering: {
      true: 'animate-in duration-200 ease-out fade-in',
    },
    isExiting: {
      true: 'animate-out duration-200 ease-in fade-out',
    },
  },
});

const modalStyles = tv({
  base: 'max-h-[inherit] overflow-auto rounded-lg border bg-background shadow-lg outline outline-0 sm:rounded-lg',
  variants: {
    isEntering: {
      true: 'animate-in duration-200 fade-in-0 zoom-in-95',
    },
    isExiting: {
      true: 'animate-out duration-200 fade-out-0 zoom-out-95',
    },
  },
});

export function Modal(props: ModalOverlayProps) {
  const { isDismissable = true } = props;

  return (
    <ModalOverlay
      {...props}
      className={overlayStyles}
      isDismissable={isDismissable}
    >
      <div className="sticky top-0 left-0 box-border flex h-(--visual-viewport-height) w-full items-center justify-center p-4">
        <RACModal {...props} className={modalStyles} />
      </div>
    </ModalOverlay>
  );
}
