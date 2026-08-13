import type { ReactNode } from 'react';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';

import { cn } from '../../lib/utils';
import { Button } from '../ui/button';

export interface PaginationBarRange {
  totalItems: number;
  itemsPerPage: number;
  /** Zero-based index of the current page. */
  page: number;
  /** Trailing noun for the default readout, e.g. "users". Defaults to "items". */
  label?: ReactNode;
}

/** 1-based bounds of the current page, for a custom range readout. */
export interface PaginationBarBounds {
  start: number;
  end: number;
  total: number;
}

export interface PaginationBarProps {
  /** When provided (and more than one page of items), renders a range readout. */
  range?: PaginationBarRange;
  /** Advance a page. `undefined` disables the Next control. */
  next?: () => void;
  /** Go back a page. `undefined` disables the Previous control. */
  previous?: () => void;
  /** Custom range readout (e.g. an i18n-formatted string); overrides the default. */
  renderRange?: (bounds: PaginationBarBounds) => ReactNode;
  previousLabel?: ReactNode;
  nextLabel?: ReactNode;
  /** Accessible label for the nav landmark. */
  navLabel?: string;
  className?: string;
}

/**
 * Driven Previous/Next pager with an optional range readout. A callback left
 * `undefined` disables its control. List and table views share this one
 * pagination component. Copy is passed in (the
 * package is i18n-agnostic); English defaults keep it usable standalone.
 */
export function PaginationBar({
  range,
  next,
  previous,
  renderRange,
  previousLabel = 'Previous',
  nextLabel = 'Next',
  navLabel = 'Pagination Navigation',
  className,
}: PaginationBarProps) {
  if (range && range.totalItems <= 1 && !next && !previous) {
    return null;
  }

  const readout =
    range && range.totalItems > 1
      ? (renderRange ?? defaultRenderRange(range.label))(boundsFor(range))
      : null;

  return (
    <div className={cn('flex items-center justify-end gap-4', className)}>
      {readout ? (
        <div aria-live="polite" className="text-sm text-muted-foreground">
          {readout}
        </div>
      ) : null}
      <nav aria-label={navLabel} className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!previous}
          onClick={() => previous?.()}
        >
          <LuChevronLeft
            data-icon="inline-start"
            className="rtl:-scale-x-100"
          />
          {previousLabel}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!next}
          onClick={() => next?.()}
        >
          {nextLabel}
          <LuChevronRight data-icon="inline-end" className="rtl:-scale-x-100" />
        </Button>
      </nav>
    </div>
  );
}

function boundsFor({
  totalItems,
  itemsPerPage,
  page,
}: PaginationBarRange): PaginationBarBounds {
  return {
    start: page * itemsPerPage + 1,
    end: Math.min((page + 1) * itemsPerPage, totalItems),
    total: totalItems,
  };
}

const defaultRenderRange =
  (label: ReactNode = 'items') =>
  ({ start, end, total }: PaginationBarBounds) => (
    <>
      {start} - {end} of {total} {label}
    </>
  );
