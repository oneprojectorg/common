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
        'relative max-h-[inherit] overflow-auto p-0 outline outline-0 [[data-placement]>&]:p-4',
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
        'my-0 text-lg leading-6 font-medium text-neutral-800',
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
    <p className={cn('mt-3 text-sm text-neutral-600', className)}>{children}</p>
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
    <div className={cn('mt-6 flex justify-end gap-2', className)}>
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
