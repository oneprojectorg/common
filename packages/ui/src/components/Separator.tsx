'use client';

import {
  Separator as RACSeparator,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

import type {
  SeparatorProps,
} from 'react-aria-components';

const styles = tv({
  base: 'bg-neutral-400',
  variants: {
    orientation: {
      horizontal: 'h-px w-full',
      vertical: 'w-px',
    },
  },
  defaultVariants: {
    orientation: 'horizontal',
  },
});

export const Separator = (props: SeparatorProps) => {
  return (
    <RACSeparator
      {...props}
      className={styles({
        orientation: props.orientation,
        className: props.className,
      })}
    />
  );
};
