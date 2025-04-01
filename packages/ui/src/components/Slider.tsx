'use client';

import {
  Slider as AriaSlider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { composeTailwindRenderProps, focusRing } from '../utils';

import { Label } from './Field';

import type {
  SliderProps as AriaSliderProps,
} from 'react-aria-components';

const trackStyles = tv({
  base: 'rounded-full',
  variants: {
    orientation: {
      horizontal: 'h-[6px] w-full',
      vertical: 'ml-[50%] h-full w-[6px] -translate-x-1/2',
    },
    isDisabled: {
      false: 'bg-neutral-500',
      true: 'bg-neutral-200',
    },
  },
});

const thumbStyles = tv({
  extend: focusRing,
  base: ' size-6 rounded-full border-2  bg-neutral-100 group-orientation-horizontal:mt-6 group-orientation-vertical:ml-3',
  variants: {
    isDragging: {
      true: 'bg-neutral-700',
    },
    isDisabled: {
      true: 'border',
    },
  },
});

export interface SliderProps<T> extends AriaSliderProps<T> {
  label?: string;
  thumbLabels?: string[];
}

export const Slider = <T extends number | number[]>({
  label,
  thumbLabels,
  ...props
}: SliderProps<T>) => {
  return (
    <AriaSlider
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'grid-cols-[1fr_auto] flex-col items-center gap-2 orientation-horizontal:grid orientation-horizontal:w-64 orientation-vertical:flex',
      )}
    >
      <Label>{label}</Label>
      <SliderOutput className="text-sm font-medium text-neutral-600 orientation-vertical:hidden">
        {({ state }) =>
          state.values.map((_, i) => state.getThumbValueLabel(i)).join(' – ')}
      </SliderOutput>
      <SliderTrack className="group col-span-2 flex items-center orientation-horizontal:h-6 orientation-vertical:h-64 orientation-vertical:w-6">
        {({ state, ...renderProps }) => (
          <>
            <div className={trackStyles(renderProps)} />
            {state.values.map((_, i) => (
              <SliderThumb
                key={`${i + 1}`}
                index={i}
                aria-label={thumbLabels?.[i]}
                className={thumbStyles}
              />
            ))}
          </>
        )}
      </SliderTrack>
    </AriaSlider>
  );
};
