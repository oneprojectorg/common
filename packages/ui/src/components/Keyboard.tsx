'use client';

import { Keyboard as AriaKeyboard } from 'react-aria-components';

import { cn } from '../lib/utils';

type KeyboardProps = React.ComponentProps<typeof AriaKeyboard>;

const Keyboard = ({ children, ...props }: KeyboardProps) => {
  return (
    <AriaKeyboard
      {...props}
      className={cn(
        'text-right font-mono text-neutral-600 group-focus:text-neutral-800',
        props.className,
      )}
    >
      {children}
    </AriaKeyboard>
  );
};

export default Keyboard;
