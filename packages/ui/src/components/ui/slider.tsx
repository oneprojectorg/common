// @ts-nocheck — vendored Taki registry file; rewrite before removing this directive
'use client';

import {
  Slider as AriaSlider,
  SliderProps as AriaSliderProps,
  composeRenderProps,
  SliderOutput,
  SliderThumb,
  SliderTrack,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { cn, focusRing } from '../../lib/utils';
import { FieldLabel } from './field';

const trackStyles = tv({
  base: 'relative overflow-hidden rounded-full bg-muted',
  variants: {
    orientation: {
      horizontal: 'h-1.5 w-full',
      vertical: 'ml-[50%] h-full w-1.5 -translate-x-[50%]',
    },
    isDisabled: {
      false: '',
      true: 'opacity-50',
    },
  },
});

const rangeStyles = tv({
  base: 'absolute bg-primary',
  variants: {
    orientation: {
      horizontal: 'h-full',
      vertical: 'w-full',
    },
  },
});

const thumbStyles = tv({
  extend: focusRing,
  base: 'size-4 rounded-full border border-primary bg-white shadow-sm outline-hidden transition-[color,box-shadow] group-orientation-horizontal:mt-4 group-orientation-vertical:ml-3',
  variants: {
    isDragging: {
      true: 'ring-4 ring-ring/50',
    },
    isFocusVisible: {
      true: 'ring-4 ring-ring/50',
    },
    isDisabled: {
      true: 'pointer-events-none opacity-50',
    },
  },
});

export interface SliderProps<T> extends AriaSliderProps<T> {
  label?: string;
  thumbLabels?: string[];
}

export function Slider<T extends number | number[]>({
  label,
  thumbLabels,
  ...props
}: SliderProps<T>) {
  return (
    <AriaSlider
      {...props}
      className={composeRenderProps(props.className, (className) =>
        cn(
          'grid-cols-[1fr_auto] flex-col items-center gap-2 orientation-horizontal:grid orientation-horizontal:w-64 orientation-vertical:flex',
          className,
        ),
      )}
    >
      <FieldLabel>{label}</FieldLabel>
      <SliderOutput className="text-sm font-medium text-muted-foreground orientation-vertical:hidden">
        {({ state }) =>
          state.values.map((_, i) => state.getThumbValueLabel(i)).join(' – ')
        }
      </SliderOutput>
      <SliderTrack className="group col-span-2 flex items-center orientation-horizontal:h-6 orientation-vertical:h-64 orientation-vertical:w-6">
        {({ state, ...renderProps }) => {
          const orientation = renderProps.orientation || 'horizontal';
          const isHorizontal = orientation === 'horizontal';
          const minValue = state.getThumbMinValue(0);
          const maxValue = state.getThumbMaxValue(state.values.length - 1);
          const range = maxValue - minValue;

          const fillStart =
            state.values.length > 1
              ? ((state.values[0] - minValue) / range) * 100
              : 0;
          const fillEnd =
            state.values.length > 1
              ? ((state.values[state.values.length - 1] - minValue) / range) *
                100
              : ((state.values[0] - minValue) / range) * 100;
          const fillSize = fillEnd - fillStart;

          return (
            <>
              <div className={trackStyles(renderProps)}>
                <div
                  className={rangeStyles({ orientation })}
                  style={
                    isHorizontal
                      ? { left: `${fillStart}%`, width: `${fillSize}%` }
                      : { bottom: `${fillStart}%`, height: `${fillSize}%` }
                  }
                />
              </div>
              {state.values.map((_, i) => (
                <SliderThumb
                  key={i}
                  index={i}
                  aria-label={thumbLabels?.[i]}
                  className={thumbStyles}
                />
              ))}
            </>
          );
        }}
      </SliderTrack>
    </AriaSlider>
  );
}
