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
  base: 'flex h-10 min-w-18 cursor-default items-center rounded-full p-1 outline-offset-0 outline-transparent transition-colors duration-300 focus:ring-transparent',
  variants: {
    isSelected: {
      false: 'bg-lightGray',
      true: 'bg-green',
    },
    isDisabled: {
      true: 'border-white/5 bg-neutral-200 text-neutral-400',
    },
  },
});

export const ToggleButton = (props: ToggleButtonProps) => {
  return (
    <RACToggleButton
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        styles({ ...renderProps, className }),
      )}
    >
      {({ isSelected }) => (
        <div
          className={cn(
            'size-8 rounded-full bg-white shadow-md transition-transform duration-300',
            isSelected ? 'translate-x-8' : 'translate-x-0',
          )}
        />
      )}
    </RACToggleButton>
  );
};
