'use client';

import {
  ColorThumb as AriaColorThumb,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

import type {
  ColorThumbProps,
} from 'react-aria-components';

const thumbStyles = tv({
  base: 'left-[50%] top-[50%] size-6 rounded-full border-2 border-white',
  variants: {
    isFocusVisible: {
      true: 'size-8',
    },
    isDragging: {
      true: 'bg-neutral-700',
    },
    isDisabled: {
      true: '-neutral-300 border bg-neutral-200',
    },
  },
});

export const ColorThumb = (props: ColorThumbProps) => {
  return (
    <AriaColorThumb
      {...props}
      style={({ defaultStyle, isDisabled }) => ({
        ...defaultStyle,
        backgroundColor: isDisabled ? undefined : defaultStyle.backgroundColor,
        boxShadow: '0 0 0 1px black, inset 0 0 0 1px black',
      })}
      className={thumbStyles}
    />
  );
};
