'use client';

import {
  ToggleButtonGroup as RACToggleButtonGroup,
  composeRenderProps,
} from 'react-aria-components';
import type { ToggleButtonGroupProps } from 'react-aria-components';
import { tv } from 'tailwind-variants';

const styles = tv({
  base: 'flex gap-1',
  variants: {
    orientation: {
      horizontal: 'flex-row',
      vertical: 'flex-col',
    },
  },
});

export const ToggleButtonGroup = (props: ToggleButtonGroupProps) => {
  return (
    <RACToggleButtonGroup
      {...props}
      className={composeRenderProps(props.className, (className) =>
        styles({ orientation: props.orientation || 'horizontal', className }),
      )}
    />
  );
};
