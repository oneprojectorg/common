'use client';

import {
  ToggleButton as RACToggleButton,
  composeRenderProps,
} from 'react-aria-components';
import type { ToggleButtonProps } from 'react-aria-components';

import { cn, tv } from '../lib/utils';
import { focusRing } from '../utils';

const styles = tv({
  extend: focusRing,
  base: 'flex cursor-pointer items-center rounded-full p-1 outline-offset-0 outline-transparent transition-colors duration-300 focus-visible:ring-transparent',
  variants: {
    size: {
      default: 'h-10 min-w-18',
      small: 'h-5 min-w-8',
    },
    isSelected: {
      false: 'bg-lightGray',
      true: 'bg-green',
    },
    isDisabled: {
      true: 'border-white/5 bg-neutral-200 text-neutral-400',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

export const ToggleButton = (
  props: ToggleButtonProps & { size?: 'default' | 'small' },
) => {
  return (
    <RACToggleButton
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        styles({ ...renderProps, size: props.size, className }),
      )}
    >
      {({ isSelected }) => (
        <div
          className={cn(
            'rounded-full bg-white shadow-md transition-transform duration-300',
            props.size === 'small' ? 'size-4' : 'size-8',
            isSelected
              ? props.size === 'small'
                ? 'translate-x-2.5'
                : 'translate-x-8'
              : props.size === 'small'
                ? '-translate-x-px'
                : 'translate-x-0',
          )}
        />
      )}
    </RACToggleButton>
  );
};
