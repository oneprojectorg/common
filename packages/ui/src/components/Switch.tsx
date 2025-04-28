'use client';

import { Switch as AriaSwitch } from 'react-aria-components';
import type { SwitchProps as AriaSwitchProps } from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { cn } from '../lib/utils';
import { composeTailwindRenderProps, focusRing } from '../utils';

export interface SwitchProps extends Omit<AriaSwitchProps, 'children'> {
  children?: React.ReactNode;
  trackClassName?: string;
}

const track = tv({
  extend: focusRing,
  base: 'flex h-4 w-7 shrink-0 cursor-default items-center rounded-full border border-transparent px-px shadow-inner transition duration-200 ease-in-out',
  variants: {
    isSelected: {
      false: 'bg-neutral-600 group-pressed:bg-neutral-700',
      true: 'bg-neutral-500 group-pressed:bg-neutral-800',
    },
    isDisabled: {
      true: 'bg-neutral-400',
    },
  },
});

const handle = tv({
  base: 'size-3 transform rounded-full bg-neutral-100 shadow outline outline-1 -outline-offset-1 outline-transparent transition duration-200 ease-in-out',
  variants: {
    isSelected: {
      false: 'translate-x-0',
      true: 'translate-x-full',
    },
    isDisabled: {
      true: ' ',
    },
  },
});

export const Switch = ({ children, trackClassName, ...props }: SwitchProps) => {
  return (
    <AriaSwitch
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'group flex items-center gap-2 text-sm text-neutral-800 transition disabled:text-neutral-400',
      )}
    >
      {(renderProps) => (
        <>
          <div
            className={track({
              ...renderProps,
              className: cn('outline-offset-2', trackClassName),
            })}
          >
            <span className={handle(renderProps)} />
          </div>
          {children}
        </>
      )}
    </AriaSwitch>
  );
};
