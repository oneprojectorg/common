'use client';

import { Button } from '@op/sense/Button';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

/**
 * Cursor-driven Previous/Next pager with a "1 - 5 of 100 items" range readout.
 * A callback left `undefined` disables its button. Built on `@op/sense`
 * primitives, mirroring the previous driven-pagination range API.
 */
export const TablePagination = ({
  totalItems,
  itemsPerPage,
  page,
  label,
  next,
  previous,
}: {
  totalItems: number;
  itemsPerPage: number;
  /** Zero-based current page index. */
  page: number;
  /** Already-translated noun for the range readout (e.g. "users"). */
  label: string;
  next: (() => void) | undefined;
  previous: (() => void) | undefined;
}) => {
  const t = useTranslations();

  if (totalItems <= 1 && !next && !previous) {
    return null;
  }

  const start = page * itemsPerPage + 1;
  const end = Math.min((page + 1) * itemsPerPage, totalItems);

  return (
    <div className="flex items-center justify-end gap-4">
      {totalItems > 1 ? (
        <div aria-live="polite" className="text-sm text-muted-foreground">
          {t('{start} - {end} of {total} {label}', {
            start,
            end,
            total: totalItems,
            label,
          })}
        </div>
      ) : null}
      <nav
        aria-label={t('Pagination Navigation')}
        className="flex justify-end gap-2"
      >
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
          {t('Previous')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!next}
          onClick={() => next?.()}
        >
          {t('Next')}
          <LuChevronRight data-icon="inline-end" className="rtl:-scale-x-100" />
        </Button>
      </nav>
    </div>
  );
};
