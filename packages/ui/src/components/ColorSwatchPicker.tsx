'use client';

import {
  ColorSwatchPicker as AriaColorSwatchPicker,
  ColorSwatchPickerItem as AriaColorSwatchPickerItem,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { composeTailwindRenderProps, focusRing } from '../utils';

import { ColorSwatch } from './ColorSwatch';

import type {
  ColorSwatchPickerItemProps,
  ColorSwatchPickerProps,
} from 'react-aria-components';

export const ColorSwatchPicker = ({
  children,
  ...props
}: Omit<ColorSwatchPickerProps, 'layout'>) => {
  return (
    <AriaColorSwatchPicker
      {...props}
      className={composeTailwindRenderProps(props.className, 'flex gap-1')}
    >
      {children}
    </AriaColorSwatchPicker>
  );
};

const itemStyles = tv({
  extend: focusRing,
  base: 'relative rounded',
});

export const ColorSwatchPickerItem = (props: ColorSwatchPickerItemProps) => {
  return (
    <AriaColorSwatchPickerItem {...props} className={itemStyles}>
      {({ isSelected }) => (
        <>
          <ColorSwatch />
          {isSelected && (
            <div className="absolute left-0 top-0 size-full rounded border-2 border-white outline outline-2 -outline-offset-4 outline-black forced-color-adjust-none" />
          )}
        </>
      )}
    </AriaColorSwatchPickerItem>
  );
};
