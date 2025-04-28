'use client';

import { ArrowUp } from 'lucide-react';
import {
  Cell as AriaCell,
  Column as AriaColumn,
  Row as AriaRow,
  Table as AriaTable,
  TableHeader as AriaTableHeader,
  Button,
  Collection,
  ColumnResizer,
  Group,
  ResizableTableContainer,
  composeRenderProps,
  useTableOptions,
} from 'react-aria-components';
import type {
  CellProps,
  ColumnProps,
  RowProps,
  TableHeaderProps,
  TableProps,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { composeTailwindRenderProps, focusRing } from '../utils';
import { Checkbox } from './Checkbox';

export const Table = (props: TableProps) => {
  return (
    <ResizableTableContainer className="relative max-h-[280px] w-[550px] scroll-pt-[2.281rem] overflow-auto rounded-lg border">
      <AriaTable {...props} className="border-separate border-spacing-0" />
    </ResizableTableContainer>
  );
};

const columnStyles = tv({
  extend: focusRing,
  base: 'flex h-5 flex-1 items-center gap-1 overflow-hidden px-2',
});

const resizerStyles = tv({
  extend: focusRing,
  base: 'box-content h-5 w-px translate-x-[8px] cursor-col-resize rounded bg-neutral-500 bg-clip-content px-[8px] py-1 -outline-offset-2 resizing:w-[2px] resizing:bg-neutral-400 resizing:pl-[7px]',
});

export const Column = (props: ColumnProps) => {
  return (
    <AriaColumn
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'cursor-default text-start text-sm font-semibold text-neutral-700 [&:focus-within]:z-20 [&:hover]:z-20',
      )}
    >
      {composeRenderProps(
        props.children,
        (children, { allowsSorting, sortDirection }) => (
          <div className="flex items-center">
            <Group role="presentation" tabIndex={-1} className={columnStyles}>
              <span className="truncate">{children}</span>
              {allowsSorting && (
                <span
                  className={`flex size-4 items-center justify-center transition ${
                    sortDirection === 'descending' ? 'rotate-180' : ''
                  }`}
                >
                  {sortDirection && (
                    <ArrowUp aria-hidden className="size-4 text-neutral-600" />
                  )}
                </span>
              )}
            </Group>
            {!props.width && <ColumnResizer className={resizerStyles} />}
          </div>
        ),
      )}
    </AriaColumn>
  );
};

export const TableHeader = <T extends object>(props: TableHeaderProps<T>) => {
  const { selectionBehavior, selectionMode, allowsDragging } =
    useTableOptions();

  return (
    <AriaTableHeader
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        '-neutral-300 sticky top-0 z-10 rounded-t-lg border-b bg-neutral-300/60 backdrop-blur-md supports-[-moz-appearance:none]:bg-neutral-300',
      )}
    >
      {/* Add extra columns for drag and drop and selection. */}
      {allowsDragging && <Column />}
      {selectionBehavior === 'toggle' && (
        <AriaColumn
          width={36}
          minWidth={36}
          className="cursor-default p-2 text-start text-sm font-semibold"
        >
          {selectionMode === 'multiple' && <Checkbox slot="selection" />}
        </AriaColumn>
      )}
      <Collection items={props.columns}>{props.children}</Collection>
    </AriaTableHeader>
  );
};

const cellStyles = tv({
  extend: focusRing,
  base: '-neutral-300 truncate border-b p-2 -outline-offset-2 [--selected-border:theme(colors.blue.900)] group-last/row:border-b-0 group-selected/row:border-[--selected-border] [:has(+[data-selected])_&]:border-[--selected-border]',
});

export const Cell = (props: CellProps) => {
  return <AriaCell {...props} className={cellStyles} />;
};

const rowStyles = tv({
  extend: focusRing,
  base: 'group/row relative cursor-default select-none text-sm text-neutral-800 -outline-offset-2 hover:bg-neutral-300/60 selected:bg-neutral-300/30 selected:hover:bg-neutral-300/40 disabled:text-neutral-400',
});

export const Row = <T extends object>({
  id,
  columns,
  children,
  ...otherProps
}: RowProps<T>) => {
  const { selectionBehavior, allowsDragging } = useTableOptions();

  return (
    <AriaRow id={id} {...otherProps} className={rowStyles}>
      {allowsDragging && (
        <Cell>
          <Button slot="drag">≡</Button>
        </Cell>
      )}
      {selectionBehavior === 'toggle' && (
        <Cell>
          <Checkbox slot="selection" />
        </Cell>
      )}
      <Collection items={columns}>{children}</Collection>
    </AriaRow>
  );
};
