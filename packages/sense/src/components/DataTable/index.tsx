'use client';

import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
  type CellData,
  type Column,
  type ColumnDef,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type TableFeatures,
} from '@tanstack/react-table';
import { useMemo, useState, type ReactNode } from 'react';
import {
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuChevronUp,
  LuChevronsUpDown,
  LuCircleAlert,
} from 'react-icons/lu';

import { cn } from '../../lib/utils';
import { Alert, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '../ui/empty';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from '../ui/table';

declare module '@tanstack/react-table' {
  interface ColumnMeta<
    TFeatures extends TableFeatures,
    TData extends RowData,
    TValue extends CellData = CellData,
  > {
    /** `end` for numbers and row actions: right-aligned in LTR. */
    align?: 'start' | 'end';
    /** A fixed width as a Tailwind class (`w-24`). Leave it off one column, usually the title, to take the rest. */
    width?: string;
  }
}

/** The TanStack Table v9 features a DataTable uses. */
export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: { includesString: filterFn_includesString },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
});

export type DataTableFeatures = typeof dataTableFeatures;

export type DataTableColumnDef<TData extends RowData> = ColumnDef<
  DataTableFeatures,
  TData
>;

/** Every string the table renders. Sense is i18n-agnostic: pass translations in. */
export interface DataTableCopy {
  searchLabel: string;
  searchPlaceholder: string;
  noResults: string;
  noResultsDescription: string;
  clearSearch: string;
  selected: (count: number) => string;
  clearSelection: string;
  selectAll: string;
  selectRow: (rowLabel: string) => string;
  /** The noun in the range readout: "1 - 8 of 12 proposals". */
  items: string;
  range: (start: number, end: number, total: number, items: string) => string;
  previous: string;
  next: string;
  pagination: string;
  loading: string;
}

export interface DataTableProps<TData extends RowData> {
  /** Plain-string `header`s become sortable header buttons; `meta.align: 'end'` right-aligns a column. */
  columns: DataTableColumnDef<TData>[];
  data: TData[];
  /** A stable id per row, so a selection survives sorting and paging. */
  getRowId?: (row: TData) => string;
  /** Id of the column that names each row; its cells render as row headers. */
  rowHeader?: string;
  /** The row's name, for its checkbox's accessible name ("Select …"). */
  rowLabel?: (row: TData) => string;
  /** Add a checkbox column and the selection bar. */
  selectable?: boolean;
  /** Bulk actions for the selection bar, given the selected rows. */
  selectionActions?: (selected: TData[]) => ReactNode;
  /** Secondary actions at the end of the toolbar. */
  actions?: ReactNode;
  /** Show the search box. It searches every column. */
  searchable?: boolean;
  /** The search text at first render. */
  initialSearch?: string;
  /** The sort at first render, e.g. `[{ id: 'updated', desc: true }]`. */
  initialSorting?: SortingState;
  pageSize?: number;
  /** Render the real header over five skeleton rows. */
  loading?: boolean;
  /** An error shown above the table; the rows stay visible. */
  error?: ReactNode;
  copy?: Partial<DataTableCopy>;
  className?: string;
}

const DEFAULT_COPY: DataTableCopy = {
  searchLabel: 'Search',
  searchPlaceholder: 'Search',
  noResults: 'No results',
  noResultsDescription: 'Clear the search or try another word.',
  clearSearch: 'Clear search',
  selected: (count) => `${count} selected`,
  clearSelection: 'Clear selection',
  selectAll: 'Select all on this page',
  selectRow: (rowLabel) => `Select ${rowLabel}`,
  items: 'items',
  range: (start, end, total, items) => `${start} - ${end} of ${total} ${items}`,
  previous: 'Previous',
  next: 'Next',
  pagination: 'Pages',
  loading: 'Loading',
};

const SELECT_COLUMN = 'select';
const SKELETON_ROWS = [0, 1, 2, 3, 4];

/**
 * A table for records people work through: search, sort one column at a time,
 * select rows and act on the selection, and page. Built on TanStack Table v9
 * and the `Table`, `Checkbox`, `Button`, `Input`, `Empty`, `Skeleton` and
 * `Alert` primitives. Columns keep fixed widths (`meta.width`) and a short last
 * page is padded, so nothing shifts from page to page. Use plain `Table` for rows that are read
 * and never worked on.
 */
export function DataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
  rowHeader,
  rowLabel,
  selectable = false,
  selectionActions,
  actions,
  searchable = true,
  initialSearch = '',
  initialSorting = [],
  pageSize = 10,
  loading = false,
  error,
  copy,
  className,
}: DataTableProps<TData>) {
  const text = { ...DEFAULT_COPY, ...copy };
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [globalFilter, setGlobalFilter] = useState(initialSearch);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const allColumns = useMemo(
    () => (selectable ? [selectColumn<TData>(), ...columns] : columns),
    [columns, selectable],
  );

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns: allColumns,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    state: { sorting, globalFilter, rowSelection },
    initialState: { pagination: { pageIndex: 0, pageSize } },
    enableMultiSort: false,
    enableSortingRemoval: false,
    enableRowSelection: selectable,
    globalFilterFn: 'includesString',
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
  });

  const selectedRows = table.getSelectedRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const { pageIndex } = table.state.pagination;
  const rows = table.getRowModel().rows;
  const columnCount = table.getVisibleLeafColumns().length;
  const fillerCount = rows.length ? pageSize - rows.length : 0;
  const start = pageIndex * pageSize + 1;
  const end = start + rows.length - 1;

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {selectedRows.length > 0 ? (
        <div className="flex min-h-11 items-center gap-3">
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {text.selected(selectedRows.length)}
          </span>
          {selectionActions?.(selectedRows.map((row) => row.original))}
          <Button
            variant="ghost"
            className="ms-auto"
            onClick={() => table.resetRowSelection(true)}
          >
            {text.clearSelection}
          </Button>
        </div>
      ) : searchable || actions ? (
        <div className="flex min-h-11 items-center gap-3">
          {searchable && (
            <Input
              type="search"
              aria-label={text.searchLabel}
              placeholder={text.searchPlaceholder}
              value={globalFilter}
              disabled={loading}
              onChange={(event) => table.setGlobalFilter(event.target.value)}
              className="max-w-sm"
            />
          )}
          {actions && <div className="ms-auto flex gap-2">{actions}</div>}
        </div>
      ) : null}

      {error && (
        <Alert variant="destructive">
          <LuCircleAlert aria-hidden />
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      )}

      <Table aria-busy={loading || undefined} className="table-fixed">
        <colgroup>
          {table.getVisibleLeafColumns().map((column) => (
            <col
              key={column.id}
              className={
                column.id === SELECT_COLUMN
                  ? 'w-10'
                  : column.columnDef.meta?.width
              }
            />
          ))}
        </colgroup>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const { column } = header;
                const end = column.columnDef.meta?.align === 'end';
                if (header.isPlaceholder) {
                  return <TableHead key={header.id} />;
                }
                if (column.id === SELECT_COLUMN) {
                  return (
                    <TableHead key={header.id} className="w-10">
                      <Checkbox
                        aria-label={text.selectAll}
                        disabled={loading || rows.length === 0}
                        checked={table.getIsAllPageRowsSelected()}
                        indeterminate={table.getIsSomePageRowsSelected()}
                        onCheckedChange={(checked) =>
                          table.toggleAllPageRowsSelected(checked)
                        }
                      />
                    </TableHead>
                  );
                }
                const label = <table.FlexRender header={header} />;
                if (!column.getCanSort() || loading) {
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(end && 'text-end')}
                    >
                      {label}
                    </TableHead>
                  );
                }
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={ariaSort(column)}
                    className={cn(end && 'text-end')}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn('gap-1', end ? '-me-2' : '-ms-2')}
                      onClick={() => column.toggleSorting()}
                    >
                      {label}
                      <SortIcon column={column} />
                    </Button>
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            SKELETON_ROWS.map((index) => (
              <TableRow key={index}>
                {table.getVisibleLeafColumns().map((column) => (
                  <TableCell key={column.id}>
                    <Skeleton
                      className={cn(
                        column.id === SELECT_COLUMN ? 'size-4' : 'h-4 w-3/4',
                        column.columnDef.meta?.align === 'end' && 'ms-auto',
                      )}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length ? (
            [
              ...rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                >
                  {row.getVisibleCells().map((cell) => {
                    const end = cell.column.columnDef.meta?.align === 'end';
                    if (cell.column.id === SELECT_COLUMN) {
                      return (
                        <TableCell key={cell.id}>
                          <Checkbox
                            aria-label={text.selectRow(
                              rowLabel ? rowLabel(row.original) : row.id,
                            )}
                            checked={row.getIsSelected()}
                            onCheckedChange={(checked) =>
                              row.toggleSelected(checked)
                            }
                          />
                        </TableCell>
                      );
                    }
                    const content = <table.FlexRender cell={cell} />;
                    return cell.column.id === rowHeader ? (
                      <TableRowHeader
                        key={cell.id}
                        className={cn(end && 'text-end')}
                      >
                        {content}
                      </TableRowHeader>
                    ) : (
                      <TableCell
                        key={cell.id}
                        className={cn(end && 'text-end')}
                      >
                        {content}
                      </TableCell>
                    );
                  })}
                </TableRow>
              )),
              // A short last page keeps the full page's height, so the pager stays put.
              ...Array.from({ length: fillerCount }, (_, index) => (
                <TableRow
                  key={`filler-${index}`}
                  aria-hidden
                  className="pointer-events-none hover:bg-transparent"
                >
                  <TableCell colSpan={columnCount}>
                    <div className="h-9" />
                  </TableCell>
                </TableRow>
              )),
            ]
          ) : (
            <TableRow>
              <TableCell colSpan={columnCount}>
                <Empty className="border-0">
                  <EmptyHeader>
                    <EmptyTitle>{text.noResults}</EmptyTitle>
                    {globalFilter && (
                      <EmptyDescription>
                        {text.noResultsDescription}
                      </EmptyDescription>
                    )}
                  </EmptyHeader>
                  {globalFilter && (
                    <EmptyContent>
                      <Button
                        variant="outline"
                        onClick={() => table.setGlobalFilter('')}
                      >
                        {text.clearSearch}
                      </Button>
                    </EmptyContent>
                  )}
                </Empty>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {loading && (
        <span className="sr-only" aria-live="polite">
          {text.loading}
        </span>
      )}

      {!loading && rows.length > 0 && (
        <div className="flex items-center justify-end gap-4">
          <span
            className="text-sm text-muted-foreground tabular-nums"
            aria-live="polite"
          >
            {text.range(start, end, filteredCount, text.items)}
          </span>
          <nav aria-label={text.pagination} className="flex gap-2">
            <Button
              variant="outline"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <LuChevronLeft
                aria-hidden
                data-icon="inline-start"
                className="rtl:-scale-x-100"
              />
              {text.previous}
            </Button>
            <Button
              variant="outline"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              {text.next}
              <LuChevronRight
                aria-hidden
                data-icon="inline-end"
                className="rtl:-scale-x-100"
              />
            </Button>
          </nav>
        </div>
      )}
    </div>
  );
}

/** A column helper bound to the DataTable features, for typed column definitions. */
export function createDataTableColumns<TData extends RowData>() {
  return createColumnHelper<DataTableFeatures, TData>();
}

/** The checkbox column; DataTable renders its header and cells itself. */
function selectColumn<TData extends RowData>(): DataTableColumnDef<TData> {
  return createDataTableColumns<TData>().display({
    id: SELECT_COLUMN,
    enableSorting: false,
    enableGlobalFilter: false,
  });
}

function SortIcon<TData extends RowData, TValue extends CellData>({
  column,
}: {
  column: Column<DataTableFeatures, TData, TValue>;
}) {
  const sorted = column.getIsSorted();
  if (sorted === 'asc') return <LuChevronUp aria-hidden />;
  if (sorted === 'desc') return <LuChevronDown aria-hidden />;
  return <LuChevronsUpDown aria-hidden className="text-muted-foreground" />;
}

function ariaSort<TData extends RowData, TValue extends CellData>(
  column: Column<DataTableFeatures, TData, TValue>,
): 'ascending' | 'descending' | 'none' {
  const sorted = column.getIsSorted();
  if (sorted === 'asc') return 'ascending';
  if (sorted === 'desc') return 'descending';
  return 'none';
}
