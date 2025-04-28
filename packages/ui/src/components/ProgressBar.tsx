'use client';

import { ProgressBar as AriaProgressBar } from 'react-aria-components';
import type { ProgressBarProps as AriaProgressBarProps } from 'react-aria-components';

import { composeTailwindRenderProps } from '../utils';
import { Label } from './Field';

export interface ProgressBarProps extends AriaProgressBarProps {
  label?: string;
}

export const ProgressBar = ({ label, ...props }: ProgressBarProps) => {
  return (
    <AriaProgressBar
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'flex flex-col gap-1',
      )}
    >
      {({ percentage, valueText, isIndeterminate }) => (
        <>
          <div className="flex justify-between gap-2">
            <Label>{label}</Label>
            <span className="text-sm text-neutral-600">{valueText}</span>
          </div>
          <div className="relative h-2 w-64 overflow-hidden rounded-full bg-neutral-300 outline outline-1 -outline-offset-1 outline-transparent">
            <div
              className={`absolute top-0 h-full rounded-full bg-neutral-500 ${isIndeterminate ? 'left-full duration-1000 ease-out animate-in slide-out-to-right-full repeat-infinite [--tw-enter-translate-x:calc(-16rem-100%)]' : 'left-0'}`}
              style={{ width: `${isIndeterminate ? 40 : percentage}%` }}
            />
          </div>
        </>
      )}
    </AriaProgressBar>
  );
};
