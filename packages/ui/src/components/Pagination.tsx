'use client';

import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { type ContextValue, useContextProps } from 'react-aria-components';

import { Button } from './Button';

export interface PaginationRangeProps {
  label?: string;
  totalItems: number;
  itemsPerPage: number;
  page: number;
}

export interface PaginationNavigationCallbacks {
  next: (() => void | Promise<void>) | undefined;
  previous: (() => void | Promise<void>) | undefined;
}

export interface PaginationNavigationProps
  extends PaginationNavigationCallbacks {
  className?: string;
}

export interface PaginationProps extends PaginationNavigationProps {
  range?: PaginationRangeProps;
}

export const PaginationContext = React.createContext<
  ContextValue<Partial<PaginationProps>, HTMLDivElement>
>({});

export const Pagination = React.forwardRef<HTMLDivElement, PaginationProps>(
  function Pagination(props, ref) {
    [props, ref] = useContextProps(props, ref, PaginationContext);
    const { className, range, ...actionProps } = props;

    if (!range) {
      return (
        <PaginationNavigation
          ref={ref}
          {...actionProps}
          className={className}
        />
      );
    }

    if (range.totalItems <= 1 && !actionProps.next && !actionProps.previous) {
      return null;
    }

    return (
      <div
        ref={ref}
        className={clsx('flex items-center justify-end gap-4', className)}
      >
        {range.totalItems > 1 ? <PaginationRange {...range} /> : null}
        <PaginationNavigation {...actionProps} />
      </div>
    );
  },
);

const PaginationNavigation = React.forwardRef<
  HTMLDivElement,
  PaginationNavigationProps
>(function PaginationNavigation(props, ref) {
  const { className, next, previous } = props;

  return (
    <nav
      ref={ref}
      aria-label="Pagination Navigation"
      className={clsx('flex justify-end gap-2', className)}
    >
      <Button
        color="neutral"
        size="small"
        isDisabled={!previous}
        onPress={async () => {
          if (previous) {
            await previous();
          }
        }}
      >
        <ChevronLeft className="size-4" />
        Previous
      </Button>
      <Button
        color="neutral"
        size="small"
        isDisabled={!next}
        onPress={async () => {
          if (next) {
            await next();
          }
        }}
      >
        Next
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
});

/**
 * Displays the current page range information (e.g., "1 - 10 of 100 items")
 * Calculates start and end indices based on current page and items per page
 */
function PaginationRange(props: PaginationRangeProps): React.ReactElement {
  const { totalItems, itemsPerPage, page, label = 'items' } = props;

  // Calculate the starting index (1-based) for the current page
  const start = page * itemsPerPage + 1;
  // Calculate the ending index, ensuring it doesn't exceed total items
  const end = Math.min((page + 1) * itemsPerPage, totalItems);

  return (
    <div aria-live="polite" className="text-neutral-charcoal text-sm">
      {start} - {end} of {totalItems} {label}
    </div>
  );
}
