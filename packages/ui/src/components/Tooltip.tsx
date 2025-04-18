import {
  Tooltip as AriaTooltip,
  TooltipTrigger as AriaTooltipTrigger,
  composeRenderProps,
  OverlayArrow,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { cn } from '../lib/utils';

import type {
  TooltipProps as AriaTooltipProps,
  TooltipTriggerComponentProps,
} from 'react-aria-components';

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
  base: 'group relative z-0 rounded-md bg-charcoal px-3 py-2 font-sans text-xs text-offWhite will-change-transform',
  variants: {
    isEntering: {
      true: 'ease-out animate-in fade-in duration-animate-200 placement-left:slide-in-from-right-0.5 placement-right:slide-in-from-left-0.5 placement-top:slide-in-from-bottom-0.5 placement-bottom:slide-in-from-top-0.5',
    },
    isExiting: {
      true: 'ease-in animate-out fade-out duration-animate-150 placement-left:slide-out-to-right-0.5 placement-right:slide-out-to-left-0.5 placement-top:slide-out-to-bottom-0.5 placement-bottom:slide-out-to-top-0.5',
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
        }))}
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
          'op-ui-Tooltip grid max-w-sm items-center text-xs/[1.4]',
          Array.isArray(children) && children.length > 0 && 'gap-x-2',
        )}
      >
        {children}
      </div>
    </AriaTooltip>
  );
};

export { Tooltip, TooltipTrigger };
