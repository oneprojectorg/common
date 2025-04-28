'use client';

import {
  ColorSlider as AriaColorSlider,
  SliderOutput,
  SliderTrack,
} from 'react-aria-components';
import type { ColorSliderProps as AriaColorSliderProps } from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { composeTailwindRenderProps } from '../utils';
import { ColorThumb } from './ColorThumb';
import { Label } from './Field';

const trackStyles = tv({
  base: 'group col-span-2 rounded-lg orientation-horizontal:h-6',
  variants: {
    orientation: {
      horizontal: 'h-6 w-full',
      vertical: 'ml-[50%] h-56 w-6 -translate-x-[50%]',
    },
    isDisabled: {
      true: 'bg-neutral-200',
    },
  },
});

interface ColorSliderProps extends AriaColorSliderProps {
  label?: string;
}

export const ColorSlider = ({ label, ...props }: ColorSliderProps) => {
  return (
    <AriaColorSlider
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'grid-cols-[1fr_auto] flex-col items-center gap-2 orientation-horizontal:grid orientation-horizontal:w-56 orientation-vertical:flex',
      )}
    >
      <Label>{label}</Label>
      <SliderOutput className="text-sm font-medium text-neutral-600 orientation-vertical:hidden" />
      <SliderTrack
        className={trackStyles}
        style={({ defaultStyle, isDisabled }) => ({
          ...defaultStyle,
          background: isDisabled
            ? undefined
            : `${defaultStyle.background}, repeating-conic-gradient(#CCC 0% 25%, white 0% 50%) 50% / 16px 16px`,
        })}
      >
        <ColorThumb />
      </SliderTrack>
    </AriaColorSlider>
  );
};
