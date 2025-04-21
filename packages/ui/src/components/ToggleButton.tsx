'use client';

import {
  composeRenderProps,
  ToggleButton as RACToggleButton,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { focusRing } from '../utils';

import type { ToggleButtonProps } from 'react-aria-components';

const styles = tv({
  extend: focusRing,
  base: 'flex h-10 w-18 cursor-default items-center rounded-full p-1 outline-transparent transition-colors duration-300 focus:ring-transparent focus:ring-offset-2',
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
          className={`size-8 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
            isSelected ? 'translate-x-8' : 'translate-x-0'
          }`}
        />
      )}
    </RACToggleButton>
  );
};

export const ToggleSwitch = (props) => {
  return (
    <ToggleButton
      {...props}
      className={({ isSelected }) =>
        `flex h-8 w-14 items-center rounded-full p-1 outline-none transition-colors duration-300 focus:ring-2 focus:ring-offset-2 ${
          isSelected ? 'bg-green-500' : 'bg-gray-300'
        }`
      }
    >
      {({ isSelected }) => (
        <div
          className={`h-8 w-8 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
            isSelected ? 'translate-x-6' : 'translate-x-0'
          }`}
        />
      )}
    </ToggleButton>
  );
};
