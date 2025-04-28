'use client';

import {
  ColorPicker as AriaColorPicker,
  Button,
  DialogTrigger,
} from 'react-aria-components';
import type { ColorPickerProps as AriaColorPickerProps } from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { focusRing } from '../utils';
import { ColorArea } from './ColorArea';
import { ColorField } from './ColorField';
import { ColorSlider } from './ColorSlider';
import { ColorSwatch } from './ColorSwatch';
import { Dialog } from './Dialog';
import { Popover } from './Popover';

const buttonStyles = tv({
  extend: focusRing,
  base: 'flex cursor-default items-center gap-2 rounded text-sm text-neutral-800',
});

export interface ColorPickerProps extends AriaColorPickerProps {
  label?: string;
  children?: React.ReactNode;
}

export const ColorPicker = ({
  label,
  children,
  ...props
}: ColorPickerProps) => {
  return (
    <AriaColorPicker {...props}>
      <DialogTrigger>
        <Button className={buttonStyles}>
          <ColorSwatch />
          <span>{label}</span>
        </Button>
        <Popover placement="bottom start">
          <Dialog className="flex flex-col gap-2">
            {children || (
              <>
                <ColorArea
                  colorSpace="hsb"
                  xChannel="saturation"
                  yChannel="brightness"
                />
                <ColorSlider colorSpace="hsb" channel="hue" />
                <ColorField label="Hex" />
              </>
            )}
          </Dialog>
        </Popover>
      </DialogTrigger>
    </AriaColorPicker>
  );
};
