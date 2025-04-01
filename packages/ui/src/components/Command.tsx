'use client';

import { Command as CommandPrimitive } from 'cmdk';
import * as React from 'react';

import { cn } from '../lib/utils';

const Command = ({ ref, className, ...props }: React.ComponentProps<typeof CommandPrimitive>) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      'flex w-full flex-col overflow-hidden rounded-md',
      className,
    )}
    {...props}
  />
);

Command.displayName = CommandPrimitive.displayName;

const CommandInput = ({ ref, className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) => (
  <CommandPrimitive.Input
    ref={ref}
    className={cn(
      'flex min-h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-neutral-500 disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
);

CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = ({ ref, className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn(
      'better-scrollbar max-h-[300px] overflow-y-auto overflow-x-hidden !scrollbar-w-0',
      className,
    )}
    {...props}
  />
);

CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = ({ ref, ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="py-6 text-center text-sm"
    {...props}
  />
);

CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = ({ ref, className, hidden, children, ...props }: React.ComponentProps<typeof CommandPrimitive.Group> & {
  hidden: boolean;

}) => {
  if (hidden)
    return children;

  return (
    <CommandPrimitive.Group
      ref={ref}
      className={cn(
        'select-none overflow-hidden text-neutral-950 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-neutral-600',
        className,
      )}
      {...props}
    >
      {children}
    </CommandPrimitive.Group>
  );
};

CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandSeparator = ({ ref, className, ...props }: React.ComponentProps<typeof CommandPrimitive.Separator>) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-neutral-200', className)}
    {...props}
  />
);

CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

const CommandItem = ({ ref, className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-neutral-200 aria-selected:text-neutral-900 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
      className,
    )}
    {...props}
  />
);

CommandItem.displayName = CommandPrimitive.Item.displayName;

const CommandShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        'ml-auto text-xs tracking-widest text-neutral-500',
        className,
      )}
      {...props}
    />
  );
};

CommandShortcut.displayName = 'CommandShortcut';

export {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};
