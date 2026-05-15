// Compat wrapper for @op/ui's Pagination. Maps legacy cursor-callback API
// (next/previous/range) onto vanilla shadcn Pagination primitives.

'use client';

import * as React from 'react';

import {
  Pagination as ShadcnPagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from './ui/pagination';
import { cn } from '../lib/utils';

export interface PaginationRangeProps {
  label?: string;
  totalItems: number;
  itemsPerPage: number;
  page: number;
}

export interface PaginationProps {
  className?: string;
  next: (() => void | Promise<void>) | undefined;
  previous: (() => void | Promise<void>) | undefined;
  range?: PaginationRangeProps;
}

export const Pagination = React.forwardRef<HTMLDivElement, PaginationProps>(
  function Pagination(props, ref) {
    const { className, range, next, previous } = props;

    if (range && range.totalItems <= 1 && !next && !previous) {
      return null;
    }

    return (
      <div
        ref={ref}
        className={cn('flex items-center justify-end gap-4', className)}
      >
        {range && range.totalItems > 1 ? <PaginationRange {...range} /> : null}
        <ShadcnPagination className="mx-0 w-fit justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                aria-disabled={!previous}
                data-disabled={!previous ? '' : undefined}
                className={cn(
                  !previous && 'pointer-events-none opacity-50',
                )}
                onClick={async (e) => {
                  e.preventDefault();
                  if (previous) {
                    await previous();
                  }
                }}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                aria-disabled={!next}
                data-disabled={!next ? '' : undefined}
                className={cn(!next && 'pointer-events-none opacity-50')}
                onClick={async (e) => {
                  e.preventDefault();
                  if (next) {
                    await next();
                  }
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </ShadcnPagination>
      </div>
    );
  },
);

function PaginationRange(props: PaginationRangeProps): React.ReactElement {
  const { totalItems, itemsPerPage, page, label = 'items' } = props;
  const start = page * itemsPerPage + 1;
  const end = Math.min((page + 1) * itemsPerPage, totalItems);

  return (
    <div aria-live="polite" className="text-muted-foreground text-sm">
      {start} - {end} of {totalItems} {label}
    </div>
  );
}
