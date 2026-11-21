'use client';

import { SEARCH_MAX_LENGTH } from '@op/common/client';
import { cn } from '@op/sense/lib/utils';
import type { ReactNode } from 'react';

import { SearchField } from '@/components/SearchField';

import { ResponsiveSelect, type SelectOption } from './ResponsiveSelect';

export interface FilterBarSelectControl<T extends string = string> {
  items: SelectOption<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}

interface FilterBarSearchControl {
  value: string;
  onChange: (value: string) => void;
  isPending?: boolean;
  label: string;
}

export const filterBarRowClassName =
  'flex flex-wrap items-center justify-between gap-4';

export const FilterBar = ({ children }: { children: ReactNode }) => (
  <div className={filterBarRowClassName}>{children}</div>
);

// A box apart from `FilterBarEnd`, not one wrapping row, so the search stays one instance and keeps focus.
export const FilterBarStart = ({ children }: { children: ReactNode }) => (
  <div className="flex grow-999 flex-wrap items-center justify-between gap-4">
    {children}
  </div>
);

export const FilterBarEnd = ({ children }: { children: ReactNode }) => (
  // An auto margin on the first child, not `justify-end`, which collapses when the row overflows.
  <div className="scrollbar-none flex grow flex-wrap items-center gap-4 sm:-mx-8 sm:flex-nowrap sm:overflow-x-scroll sm:px-8 sm:[&>*:first-child]:ms-auto">
    {children}
  </div>
);

export const FilterBarSearch = ({
  value,
  onChange,
  isPending,
  label,
}: FilterBarSearchControl) => (
  <SearchField
    className="ms-auto"
    value={value}
    onChange={onChange}
    isPending={isPending}
    label={label}
    maxLength={SEARCH_MAX_LENGTH}
  />
);

export const FilterBarSelect = <T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: FilterBarSelectControl<T> & { className?: string }) => (
  <ResponsiveSelect
    selectedKey={value}
    onSelectionChange={onChange}
    aria-label={label}
    items={items}
    className={cn('min-w-40 shrink-0', className)}
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
