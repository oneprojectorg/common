'use client';

import {
  composeRenderProps,
  ToggleButton as RACToggleButton,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { focusRing } from '../utils';

import type {
  ToggleButtonProps,
} from 'react-aria-components';

const styles = tv({
  extend: focusRing,
  base: 'cursor-default rounded-lg border border-white/10 px-5 py-2 text-center text-sm shadow-none transition forced-color-adjust-none [&:has(svg:only-child)]:px-2',
  variants: {
    isSelected: {
      false:
        'bg-neutral-400 text-neutral-900 hover:bg-neutral-500 pressed:bg-neutral-600',
      true: 'bg-neutral-700 text-black hover:bg-neutral-800 pressed:bg-neutral-900',
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
        styles({ ...renderProps, className }))}
    />
  );
};
