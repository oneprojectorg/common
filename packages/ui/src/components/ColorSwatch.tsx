'use client';

import {
  ColorSwatch as AriaColorSwatch,
} from 'react-aria-components';

import { composeTailwindRenderProps } from '../utils';

import type {
  ColorSwatchProps,
} from 'react-aria-components';

export const ColorSwatch = (props: ColorSwatchProps) => {
  return (
    <AriaColorSwatch
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'h-8 w-8 rounded border border-black/10',
      )}
      style={({ color }) => ({
        background: `linear-gradient(${color.toString()}, ${color.toString()}),
          repeating-conic-gradient(#CCC 0% 25%, white 0% 50%) 50% / 16px 16px`,
      })}
    />
  );
};
