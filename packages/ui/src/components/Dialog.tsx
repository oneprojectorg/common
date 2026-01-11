'use client';

import type { ReactNode } from 'react';
import {
  DialogTrigger,
  Heading,
  Dialog as RACDialog,
} from 'react-aria-components';
import type { DialogProps, DialogTriggerProps } from 'react-aria-components';

import { cn } from '../lib/utils';

const Dialog = ({ className, ...props }: DialogProps) => {
  return (
    <RACDialog
      {...props}
      className={cn(
        'p-0 [[data-placement]>&]:p-4 relative max-h-[inherit] overflow-auto outline outline-0',
        className,
      )}
    />
  );
};

const DialogHeader = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <Heading
      slot="title"
      className={cn(
        'my-0 font-medium leading-6 text-neutral-800 text-lg',
        className,
      )}
    >
      {children}
    </Heading>
  );
};

const DialogDescription = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <p className={cn('mt-3 text-neutral-600 text-sm', className)}>{children}</p>
  );
};

const DialogFooter = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn('mt-6 gap-2 flex justify-end', className)}>
      {children}
    </div>
  );
};

const DialogContent = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return <div className={cn('mt-4', className)}>{children}</div>;
};

export type { DialogProps, DialogTriggerProps };
export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
};
