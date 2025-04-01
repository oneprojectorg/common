'use client';

import {
  ColorWheel as AriaColorWheel,
  ColorWheelTrack,
} from 'react-aria-components';

import { ColorThumb } from './ColorThumb';

import type {
  ColorWheelProps as AriaColorWheelProps,
} from 'react-aria-components';

export interface ColorWheelProps
  extends Omit<AriaColorWheelProps, 'outerRadius' | 'innerRadius'> {}

export const ColorWheel = (props: ColorWheelProps) => {
  return (
    <AriaColorWheel {...props} outerRadius={100} innerRadius={74}>
      <ColorWheelTrack
        className="disabled:bg-neutral-200"
        style={({ defaultStyle, isDisabled }) => ({
          ...defaultStyle,
          background: isDisabled
            ? undefined
            : `${defaultStyle.background}, repeating-conic-gradient(#CCC 0% 25%, white 0% 50%) 50% / 16px 16px`,
        })}
      />
      <ColorThumb />
    </AriaColorWheel>
  );
};
