'use client';

import type { ReactNode } from 'react';
import {
  TooltipTrigger as AriaTooltipTrigger,
  type TooltipTriggerComponentProps,
} from 'react-aria-components';

export { Tooltip } from './ui/tooltip';
export type { TooltipProps } from './ui/tooltip';

export interface TooltipTriggerProps extends Omit<
  TooltipTriggerComponentProps,
  'children'
> {
  children: ReactNode;
}

export const TooltipTrigger = ({
  delay = 500,
  closeDelay = 0,
  ...props
}: TooltipTriggerProps) => {
  return (
    <AriaTooltipTrigger {...props} delay={delay} closeDelay={closeDelay} />
  );
};
