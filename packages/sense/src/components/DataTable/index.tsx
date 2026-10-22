'use client';

import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type ReactTable,
  type RowData,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table';
import { useId, useState } from 'react';
import {
  LuArrowDown,
  LuArrowUp,
  LuChevronLeft,
  LuChevronRight,
  LuChevronsLeft,
  LuChevronsRight,
  LuChevronsUpDown,
  LuEyeOff,
  LuSettings2,
} from 'react-icons/lu';

import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

/**
 * The TanStack Table v9 features every DataTable uses: sorting, filtering,
 * column visibility, row selection and pagination. Build column definitions
 * against it with `createDataTableColumns`.
 */
export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
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
  noResults: string;
  filterLabel: string;
  filterPlaceholder: string;
  view: string;
  toggleColumns: string;
  rowsPerPage: string;
  page: (page: number, pageCount: number) => string;
  selected: (selected: number, total: number) => string;
  firstPage: string;
  previousPage: string;
  nextPage: string;
  lastPage: string;
  sortAscending: string;
  sortDescending: string;
  hideColumn: string;
  selectAll: string;
  selectRow: string;
}

export interface DataTableProps<TData extends RowData> {
  columns: DataTableColumnDef<TData>[];
  data: TData[];
  /** Id of the column the search box filters. No id, no search box. */
  filterColumn?: string;
  /** Show the column-visibility menu. */
  showViewOptions?: boolean;
  /** Rows per page at first render. */
  pageSize?: number;
  /** Choices in the rows-per-page menu. */
  pageSizes?: number[];
  copy?: Partial<DataTableCopy>;
  className?: string;
}

const DEFAULT_COPY: DataTableCopy = {
  noResults: 'No results.',
  filterLabel: 'Filter',
  filterPlaceholder: 'Filter…',
  view: 'View',
  toggleColumns: 'Toggle columns',
  rowsPerPage: 'Rows per page',
  page: (page, pageCount) => `Page ${page} of ${pageCount}`,
  selected: (selected, total) => `${selected} of ${total} row(s) selected.`,
  firstPage: 'Go to first page',
  previousPage: 'Go to previous page',
  nextPage: 'Go to next page',
  lastPage: 'Go to last page',
  sortAscending: 'Asc',
  sortDescending: 'Desc',
  hideColumn: 'Hide',
  selectAll: 'Select all',
  selectRow: 'Select row',
};

/**
 * A data table: sortable column headers, a search box, column visibility,
 * row selection and pagination, on TanStack Table v9 and the `Table` primitive.
 * Define columns with `createDataTableColumns`; give a column a sortable,
 * hideable header with `DataTableColumnHeader`, and a checkbox column with
 * `dataTableSelectColumn`. Use the plain `Table` for static content.
 */
export function DataTable<TData extends RowData>({
  columns,
  data,
  filterColumn,
  showViewOptions = true,
  pageSize = 10,
  pageSizes = [10, 20, 30, 40, 50],
  copy,
  className,
}: DataTableProps<TData>) {
  const text = { ...DEFAULT_COPY, ...copy };
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility, rowSelection },
    initialState: { pagination: { pageIndex: 0, pageSize } },
    enableRowSelection: true,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
  });

  const filter = filterColumn ? table.getColumn(filterColumn) : undefined;
  const rows = table.getRowModel().rows;

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {(filter || showViewOptions) && (
        <div className="flex items-center gap-2">
          {filter && (
            <Input
              aria-label={text.filterLabel}
              placeholder={text.filterPlaceholder}
              value={String(filter.getFilterValue() ?? '')}
              onChange={(event) => filter.setFilterValue(event.target.value)}
              className="h-8 max-w-sm"
            />
          )}
          {showViewOptions && (
            <DataTableViewOptions table={table} copy={copy} />
          )}
        </div>
      )}
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="h-24 text-center"
                >
                  {text.noResults}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} pageSizes={pageSizes} copy={copy} />
    </div>
  );
}

/** A column helper bound to the DataTable features, for typed column definitions. */
export function createDataTableColumns<TData extends RowData>() {
  return createColumnHelper<DataTableFeatures, TData>();
}

/** A leading checkbox column that selects rows. */
export function dataTableSelectColumn<TData extends RowData>(
  copy?: Partial<Pick<DataTableCopy, 'selectAll' | 'selectRow'>>,
): DataTableColumnDef<TData> {
  const text = { ...DEFAULT_COPY, ...copy };
  return createDataTableColumns<TData>().display({
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        aria-label={text.selectAll}
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={
          table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
        }
        onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label={text.selectRow}
        checked={row.getIsSelected()}
        onCheckedChange={(checked) => row.toggleSelected(checked)}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  });
}

/** A column header that sorts and hides its column from a menu. */
export function DataTableColumnHeader<TData extends RowData, TValue>({
  column,
  title,
  copy,
  className,
}: {
  column: Column<DataTableFeatures, TData, TValue>;
  title: string;
  copy?: Partial<DataTableCopy>;
  className?: string;
}) {
  const text = { ...DEFAULT_COPY, ...copy };
  if (!column.getCanSort()) {
    return <div className={className}>{title}</div>;
  }
  const sorted = column.getIsSorted();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="sm" className="-ms-3 font-strong" />
          }
        >
          <span>{title}</span>
          {sorted === 'desc' ? (
            <LuArrowDown aria-hidden />
          ) : sorted === 'asc' ? (
            <LuArrowUp aria-hidden />
          ) : (
            <LuChevronsUpDown aria-hidden />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
            <LuArrowUp aria-hidden />
            {text.sortAscending}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
            <LuArrowDown aria-hidden />
            {text.sortDescending}
          </DropdownMenuItem>
          {column.getCanHide() && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
                <LuEyeOff aria-hidden />
                {text.hideColumn}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** The selection count, rows-per-page menu and page controls under a table. */
export function DataTablePagination<TData extends RowData>({
  table,
  pageSizes = [10, 20, 30, 40, 50],
  copy,
}: {
  table: ReactTable<DataTableFeatures, TData>;
  pageSizes?: number[];
  copy?: Partial<DataTableCopy>;
}) {
  const text = { ...DEFAULT_COPY, ...copy };
  const rowsPerPageId = useId();
  const { pageIndex, pageSize } = table.state.pagination;
  const items = pageSizes.map((size) => ({
    value: String(size),
    label: String(size),
  }));

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-2">
      <div className="flex-1 text-sm text-muted-foreground" aria-live="polite">
        {text.selected(
          table.getFilteredSelectedRowModel().rows.length,
          table.getFilteredRowModel().rows.length,
        )}
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span id={rowsPerPageId} className="text-sm font-strong">
            {text.rowsPerPage}
          </span>
          <Select
            items={items}
            value={String(pageSize)}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger
              size="sm"
              className="w-20"
              aria-labelledby={rowsPerPageId}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm font-strong" aria-live="polite">
          {text.page(pageIndex + 1, Math.max(table.getPageCount(), 1))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            className="hidden lg:flex"
            aria-label={text.firstPage}
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <LuChevronsLeft aria-hidden className="rtl:-scale-x-100" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={text.previousPage}
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <LuChevronLeft aria-hidden className="rtl:-scale-x-100" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={text.nextPage}
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <LuChevronRight aria-hidden className="rtl:-scale-x-100" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            className="hidden lg:flex"
            aria-label={text.lastPage}
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <LuChevronsRight aria-hidden className="rtl:-scale-x-100" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/** A menu that shows and hides the table's hideable columns. */
export function DataTableViewOptions<TData extends RowData>({
  table,
  copy,
}: {
  table: ReactTable<DataTableFeatures, TData>;
  copy?: Partial<DataTableCopy>;
}) {
  const text = { ...DEFAULT_COPY, ...copy };
  const columns = table
    .getAllColumns()
    .filter((column) => column.accessorFn !== undefined && column.getCanHide());

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" className="ms-auto" />}
      >
        <LuSettings2 aria-hidden />
        {text.view}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{text.toggleColumns}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {columns.map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.getIsVisible()}
              onCheckedChange={(checked) => column.toggleVisibility(checked)}
            >
              {columnLabel(column)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A column's header text when it is a plain string, else its id. */
function columnLabel<TData extends RowData, TValue>(
  column: Column<DataTableFeatures, TData, TValue>,
): string {
  const header = column.columnDef.header;
  return typeof header === 'string' ? header : column.id;
}
