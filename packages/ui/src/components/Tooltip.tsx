'use client';

import {
  Tooltip as AriaTooltip,
  TooltipTrigger as AriaTooltipTrigger,
  OverlayArrow,
  composeRenderProps,
} from 'react-aria-components';
import type {
  TooltipProps as AriaTooltipProps,
  TooltipTriggerComponentProps,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { cn } from '../lib/utils';

export interface TooltipProps extends Omit<AriaTooltipProps, 'children'> {
  children: React.ReactNode;
}

export interface TooltipTriggerProps
  extends Omit<TooltipTriggerComponentProps, 'children'> {
  children: React.ReactNode;
}

const TooltipTrigger = ({
  children,
  delay = 500,
  closeDelay = 0,
  ...props
}: TooltipTriggerProps) => {
  return (
    <AriaTooltipTrigger {...props} delay={delay} closeDelay={closeDelay}>
      {children}
    </AriaTooltipTrigger>
  );
};

const styles = tv({
  base: 'group relative z-0 rounded-md bg-charcoal px-3 py-2 font-sans text-sm text-offWhite will-change-transform',
  variants: {
    isEntering: {
      true: 'animate-in ease-out animation-duration-200 fade-in placement-left:slide-in-from-right-1 placement-right:slide-in-from-left-1 placement-top:slide-in-from-bottom-1 placement-bottom:slide-in-from-top-1',
    },
    isExiting: {
      true: 'animate-out ease-in animation-duration-150 fade-out placement-left:slide-out-to-right-1 placement-right:slide-out-to-left-1 placement-top:slide-out-to-bottom-1 placement-bottom:slide-out-to-top-1',
    },
  },
});

const Tooltip = ({ children, ...props }: TooltipProps) => {
  return (
    <AriaTooltip
      {...props}
      offset={props.offset || 10}
      className={composeRenderProps(props.className, (className, renderProps) =>
        styles({
          ...renderProps,
          className: cn('pointer-events-none z-0 select-none', className),
        }),
      )}
    >
      <OverlayArrow className="items-center justify-center group-placement-left:-ml-px group-placement-right:-mr-px group-placement-top:-mt-px group-placement-bottom:-mb-px">
        <svg
          width={12}
          height={12}
          viewBox="0 0 12 12"
          className="fill-charcoal stroke-charcoal group-placement-left:-rotate-90 group-placement-right:rotate-90 group-placement-bottom:rotate-180"
          strokeWidth={1}
          style={{
            strokeLinejoin: 'round',
          }}
        >
          <path d="M0 0 L6 6 L12 0" />
        </svg>
      </OverlayArrow>
      <div
        className={cn(
          'op-ui-Tooltip grid max-w-sm items-center text-sm',
          Array.isArray(children) && children.length > 0 && 'gap-x-2',
        )}
      >
        {children}
      </div>
    </AriaTooltip>
  );
};

export { Tooltip, TooltipTrigger };
