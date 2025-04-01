'use client';

import {
  composeRenderProps,
  Toolbar as RACToolbar,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

import type {
  ToolbarProps,
} from 'react-aria-components';

const styles = tv({
  base: 'flex gap-2',
  variants: {
    orientation: {
      horizontal: 'flex-row',
      vertical: 'flex-col items-start',
    },
  },
});

export const Toolbar = (props: ToolbarProps) => {
  return (
    <RACToolbar
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        styles({ ...renderProps, className }))}
    />
  );
};
