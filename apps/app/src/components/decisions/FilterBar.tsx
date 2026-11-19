'use client';

import { SEARCH_MAX_LENGTH } from '@op/common/client';
import { cn } from '@op/sense/lib/utils';
import type { ReactNode } from 'react';

import { SearchField } from '@/components/SearchField';

import { ResponsiveSelect } from './ResponsiveSelect';
import { StickyFilterBar } from './StickyFilterBar';

export interface FilterBarSelectControl {
  items: { id: string; label: string; isDisabled?: boolean }[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}

interface FilterBarSearchControl {
  value: string;
  onChange: (value: string) => void;
  isPending: boolean;
  label: string;
}

/** `children` are the filter selects, followed by `FilterBarActions` groups. */
export const FilterBar = ({
  pinOffset,
  header,
  search,
  children,
}: {
  pinOffset?: number;
  header: ReactNode;
  search: FilterBarSearchControl;
  children: ReactNode;
}) => (
  <StickyFilterBar pinOffset={pinOffset}>
    {/* Two boxes, not one wrapping row, so the search field stays one instance
        (and keeps focus). The header's large grow keeps the search next to the filters. */}
    <div className="flex grow-999 flex-wrap items-center justify-between gap-4">
      {header}
      <SearchField
        className="ms-auto"
        value={search.value}
        onChange={search.onChange}
        isPending={search.isPending}
        label={search.label}
        maxLength={SEARCH_MAX_LENGTH}
      />
    </div>
    {/* Below `sm` the controls wrap onto more rows. From `sm` an auto margin on
        the first child, not `justify-end`, because it collapses when the row overflows. */}
    <div className="scrollbar-none flex grow flex-wrap items-center gap-4 sm:-mx-8 sm:flex-nowrap sm:overflow-x-scroll sm:px-8 sm:[&>*:first-child]:ms-auto">
      {children}
    </div>
  </StickyFilterBar>
);

export const FilterBarSelect = ({
  items,
  value,
  onChange,
  label,
}: FilterBarSelectControl) => (
  <ResponsiveSelect
    selectedKey={value}
    onSelectionChange={onChange}
    aria-label={label}
    items={items}
    className="min-w-40 shrink-0"
  />
);

export const FilterBarActions = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => (
  <div className={cn('flex items-center gap-4', className)}>
    <span aria-hidden className="hidden h-6 w-px bg-border sm:block" />
    {children}
  </div>
);
