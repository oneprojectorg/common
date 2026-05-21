// Generic TanStack-Table-backed data table. Wraps shadcn ui/table primitives
// with column-def-driven rendering, optional sort/selection/pagination state.
//
// Usage:
//   const columns: ColumnDef<MyRow>[] = [...]
//   <DataTable columns={columns} data={rows} />

'use client';

import {
  type ColumnDef,
  type SortingState,
  type Table as TableInstance,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import * as React from 'react';
import { LuArrowDown, LuArrowUp, LuArrowUpDown } from 'react-icons/lu';

import { cn } from '../lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** Controlled sort state. Omit for uncontrolled. */
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  /** Default sort state for uncontrolled mode. */
  defaultSorting?: SortingState;
  /** Pass-through aria-label. */
  'aria-label'?: string;
  /** Class name for the outer table element. */
  className?: string;
  /** Class name applied to every TableRow in the body. */
  rowClassName?: string;
  /** Row id resolver. Defaults to `row.id` field. */
  getRowId?: (row: TData, index: number) => string;
  /** Content rendered when there are no rows. */
  emptyState?: React.ReactNode;
  /** Imperative table ref for advanced controls. */
  tableRef?: React.Ref<TableInstance<TData>>;
}

export function DataTable<TData>({
  columns,
  data,
  sorting,
  onSortingChange,
  defaultSorting,
  'aria-label': ariaLabel,
  className,
  rowClassName,
  getRowId,
  emptyState,
  tableRef,
}: DataTableProps<TData>) {
  const [internalSorting, setInternalSorting] = React.useState<SortingState>(
    defaultSorting ?? [],
  );

  const isControlled = sorting !== undefined;
  const resolvedSorting = isControlled ? sorting : internalSorting;

  const table = useReactTable({
    data,
    columns,
    state: { sorting: resolvedSorting },
    onSortingChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(resolvedSorting) : updater;
      if (isControlled) {
        onSortingChange?.(next);
      } else {
        setInternalSorting(next);
        onSortingChange?.(next);
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId,
  });

  React.useImperativeHandle(
    tableRef as React.RefObject<TableInstance<TData>>,
    () => table,
    [table],
  );

  const rows = table.getRowModel().rows;

  return (
    <Table aria-label={ariaLabel} className={className}>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              const canSort = header.column.getCanSort();
              const sortDir = header.column.getIsSorted();
              return (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : canSort ? (
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className="flex items-center gap-1 outline-none hover:underline focus-visible:underline"
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {sortDir === 'asc' ? (
                        <LuArrowUp className="size-3.5" />
                      ) : sortDir === 'desc' ? (
                        <LuArrowDown className="size-3.5" />
                      ) : (
                        <LuArrowUpDown className="text-muted-foreground size-3.5" />
                      )}
                    </button>
                  ) : (
                    flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={columns.length}
              className="text-muted-foreground h-24 text-center"
            >
              {emptyState ?? 'No results.'}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() ? 'selected' : undefined}
              className={cn(rowClassName)}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export type { ColumnDef, SortingState };
