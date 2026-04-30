'use client';

import {
  Separator as RACSeparator,
  type SeparatorProps,
} from 'react-aria-components';

import { cn } from '../../lib/utils';

export function Separator(props: SeparatorProps) {
  const { orientation = 'horizontal', className, ...rest } = props;

  return (
    <RACSeparator
      data-slot="separator"
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...rest}
    />
  );
}

Separator.displayName = 'Separator';
