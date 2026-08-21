'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import * as React from 'react';

import { cn } from '../../lib/utils';

const tableCellClassName =
  'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pe-0';

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-base', className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn('[&_tr]:border-b', className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        'border-t bg-muted/50 text-sm font-strong [&>tr]:last:border-b-0',
        className,
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted',
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'h-10 px-2 text-start align-middle text-sm font-strong whitespace-nowrap text-muted-foreground [&:has([role=checkbox])]:pe-0',
        className,
      )}
      {...props}
    />
  );
}

function TableCell({
  className,
  render,
  ...props
}: useRender.ComponentProps<'td'>) {
  return useRender({
    defaultTagName: 'td',
    render,
    props: mergeProps<'td'>(
      {
        className: cn(tableCellClassName, className),
      },
      props,
    ),
    state: { slot: 'table-cell' },
  });
}

/** A row's identifying cell, rendered as a start-aligned `th scope="row"`. */
function TableRowHeader({
  className,
  ...props
}: Omit<React.ComponentProps<'th'>, 'scope'>) {
  return (
    <th
      data-slot="table-cell"
      className={cn(tableCellClassName, 'text-start font-normal', className)}
      {...props}
      scope="row"
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('mt-4 text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableRowHeader,
  TableCaption,
};
