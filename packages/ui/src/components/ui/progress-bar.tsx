'use client';

import {
  ProgressBar as AriaProgressBar,
  ProgressBarProps as AriaProgressBarProps,
  composeRenderProps,
} from 'react-aria-components';

import { cn } from '../../lib/utils';
import { FieldLabel } from './field';

export interface ProgressBarProps extends AriaProgressBarProps {
  label?: string;
}

export function ProgressBar({ label, ...props }: ProgressBarProps) {
  return (
    <AriaProgressBar
      {...props}
      className={composeRenderProps(props.className, (className) =>
        cn('flex flex-col gap-1', className),
      )}
    >
      {({ percentage, valueText, isIndeterminate }) => (
        <>
          <div className="flex justify-between gap-2">
            <FieldLabel>{label}</FieldLabel>
            <span className="text-sm text-muted-foreground">{valueText}</span>
          </div>
          <div className="relative h-2 w-64 overflow-hidden rounded-full bg-muted outline outline-1 -outline-offset-1 outline-transparent">
            <div
              className={`absolute top-0 h-full rounded-full bg-primary forced-colors:bg-[Highlight] ${isIndeterminate ? 'left-full animate-in duration-1000 ease-out repeat-infinite slide-in-from-left-[20rem]' : 'left-0'}`}
              style={{ width: (isIndeterminate ? 40 : percentage) + '%' }}
            />
          </div>
        </>
      )}
    </AriaProgressBar>
  );
}
