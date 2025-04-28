'use client';

import { ColorArea as AriaColorArea } from 'react-aria-components';
import type { ColorAreaProps as AriaColorAreaProps } from 'react-aria-components';

import { composeTailwindRenderProps } from '../utils';
import { ColorThumb } from './ColorThumb';

export interface ColorAreaProps extends AriaColorAreaProps {}

export const ColorArea = (props: ColorAreaProps) => {
  return (
    <AriaColorArea
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'h-56 w-56 rounded-lg bg-neutral-200',
      )}
      style={({ defaultStyle, isDisabled }) => ({
        ...defaultStyle,
        background: isDisabled ? undefined : defaultStyle.background,
      })}
    >
      <ColorThumb />
    </AriaColorArea>
  );
};
