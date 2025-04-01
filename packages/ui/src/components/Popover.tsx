'use client';

import {
  Popover as AriaPopover,
  composeRenderProps,
  OverlayArrow,
  PopoverContext,
  useSlottedContext,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

import type {
  PopoverProps as AriaPopoverProps,
} from 'react-aria-components';

export interface PopoverProps extends Omit<AriaPopoverProps, 'children'> {
  showArrow?: boolean;
  children: React.ReactNode;
}

const styles = tv({
  base: 'border-glow rounded-lg bg-neutral-100/90 text-neutral-700',
  variants: {
    isEntering: {
      true: 'transition-opacity duration-200 ease-out animate-in fade-in',
    },
    isExiting: {
      true: 'duration-150 ease-in animate-out fade-out placement-left:slide-out-to-right-1 placement-right:slide-out-to-left-1 placement-top:slide-out-to-bottom-1 placement-bottom:slide-out-to-top-1',
    },
  },
});

export const Popover = ({
  children,
  showArrow,
  className,
  ...props
}: PopoverProps) => {
  const popoverContext = useSlottedContext(PopoverContext)!;
  const isSubmenu = popoverContext?.trigger === 'SubmenuTrigger';
  let offset = showArrow ? 12 : 8;

  offset = isSubmenu ? offset - 6 : offset;

  return (
    <AriaPopover
      offset={offset}
      {...props}
      className={composeRenderProps(className, (className, renderProps) =>
        styles({ ...renderProps, className }))}
    >
      {showArrow && (
        <OverlayArrow className="group">
          <svg
            width={12}
            height={12}
            viewBox="0 0 12 12"
            className="block fill-[#1f1f21] stroke-neutral-400 stroke-1 group-placement-left:-rotate-90 group-placement-right:rotate-90 group-placement-bottom:rotate-180"
          >
            <path d="M0 0 L6 6 L12 0" />
          </svg>
        </OverlayArrow>
      )}
      {children}
    </AriaPopover>
  );
};
