'use client';

import { createContext, use } from 'react';
import type {
  CellProps,
  ColumnProps,
  ColumnResizerProps,
  TableHeaderProps as HeaderProps,
  RowProps,
  TableBodyProps,
  TableProps as TablePrimitiveProps,
} from 'react-aria-components';
import {
  Button,
  Cell,
  Collection,
  Column,
  ColumnResizer as ColumnResizerPrimitive,
  ResizableTableContainer,
  Row,
  TableBody as TableBodyPrimitive,
  TableHeader as TableHeaderPrimitive,
  Table as TablePrimitive,
  composeRenderProps,
  useTableOptions,
} from 'react-aria-components';
import { LuArrowDown } from 'react-icons/lu';
import { twJoin, twMerge } from 'tailwind-merge';

import { cx } from '@/lib/primitive';

import { Checkbox } from '@/components/Checkbox';

interface TableProps extends Omit<TablePrimitiveProps, 'className'> {
  allowResize?: boolean;
  className?: string;
  bleed?: boolean;
  grid?: boolean;
  striped?: boolean;
  ref?: React.Ref<HTMLTableElement>;
}

const TableContext = createContext<TableProps>({
  allowResize: false,
});

const useTableContext = () => use(TableContext);

const Root = (props: TableProps) => {
  return (
    <TablePrimitive
      className="w-full min-w-full caption-bottom text-sm/6 outline-hidden [--table-selected-bg:var(--color-secondary)]/50"
      {...props}
    />
  );
};

const Table = ({
  allowResize,
  className,
  bleed = false,
  grid = false,
  striped = false,
  ref,
  ...props
}: TableProps) => {
  return (
    <TableContext.Provider value={{ allowResize, bleed, grid, striped }}>
      <div className="flow-root">
        <div
          className={twMerge(
            'relative -mx-(--gutter) overflow-x-auto whitespace-nowrap [--gutter-y:--spacing(2)] has-data-[slot=table-resizable-container]:overflow-auto',
            className,
          )}
        >
          <div
            className={twJoin(
              'inline-block min-w-full align-middle',
              !bleed && 'sm:px-(--gutter)',
            )}
          >
            {allowResize ? (
              <ResizableTableContainer data-slot="table-resizable-container">
                <Root ref={ref} {...props} />
              </ResizableTableContainer>
            ) : (
              <Root {...props} ref={ref} />
            )}
          </div>
        </div>
      </div>
    </TableContext.Provider>
  );
};

const ColumnResizer = ({ className, ...props }: ColumnResizerProps) => (
  <ColumnResizerPrimitive
    {...props}
    className={cx(
      '&[data-resizable-direction=left]:cursor-e-resize &[data-resizable-direction=right]:cursor-w-resize absolute top-0 right-0 bottom-0 grid w-px touch-none place-content-center px-1 resizable-both:cursor-ew-resize [&[data-resizing]>div]:bg-primary',
      className,
    )}
  >
    <div className="h-full w-px bg-border py-(--gutter-y)" />
  </ColumnResizerPrimitive>
);

const TableBody = <T extends object>(props: TableBodyProps<T>) => (
  <TableBodyPrimitive data-slot="table-body" {...props} />
);

interface TableColumnProps extends ColumnProps {
  isResizable?: boolean;
}

const TableColumn = ({
  isResizable = false,
  className,
  ...props
}: TableColumnProps) => {
  const { bleed, grid } = useTableContext();
  return (
    <Column
      data-slot="table-column"
      {...props}
      className={composeRenderProps(
        className,
        (className, { isHovered, allowsSorting }) =>
          twMerge(
            'h-8 text-left text-sm font-normal',
            allowsSorting && isHovered ? 'text-neutral-gray3' : 'text-muted-fg',
            'allows-sorting:active:text-neutral-charcoal',
            'relative outline-hidden allows-sorting:cursor-default dragging:cursor-grabbing',
            'px-4 py-(--gutter-y)',
            'first:pl-(--gutter,--spacing(2)) last:pr-(--gutter,--spacing(2))',
            !bleed && 'sm:first:pl-1 sm:last:pr-1',
            grid && 'border-l first:border-l-0',
            isResizable && 'truncate overflow-hidden',
            className,
          ),
      )}
    >
      {(values) => (
        <div
          className={twJoin([
            'inline-flex items-center gap-0.5 **:data-[slot=icon]:shrink-0',
          ])}
        >
          {typeof props.children === 'function'
            ? props.children(values)
            : props.children}
          {values.allowsSorting && values.sortDirection !== undefined && (
            <LuArrowDown
              data-slot="icon"
              aria-hidden
              className={twJoin(
                'size-3 shrink-0 transition-transform duration-200',
                values.sortDirection === 'ascending' ? 'rotate-180' : '',
              )}
            />
          )}
          {isResizable && <ColumnResizer />}
        </div>
      )}
    </Column>
  );
};

interface TableHeaderProps<T extends object> extends HeaderProps<T> {
  ref?: React.Ref<HTMLTableSectionElement>;
}

const TableHeader = <T extends object>({
  children,
  ref,
  columns,
  className,
  ...props
}: TableHeaderProps<T>) => {
  const { bleed } = useTableContext();
  const { selectionBehavior, selectionMode, allowsDragging } =
    useTableOptions();
  return (
    <TableHeaderPrimitive
      data-slot="table-header"
      className={cx('border-b', className)}
      ref={ref}
      {...props}
    >
      {allowsDragging && (
        <Column
          data-slot="table-column"
          className={twMerge(
            'first:pl-(--gutter,--spacing(2))',
            !bleed && 'sm:first:pl-1 sm:last:pr-1',
          )}
        />
      )}
      {selectionBehavior === 'toggle' && (
        <Column
          data-slot="table-column"
          className={twMerge(
            'first:pl-(--gutter,--spacing(2))',
            !bleed && 'sm:first:pl-1 sm:last:pr-1',
          )}
        >
          {selectionMode === 'multiple' && (
            <Checkbox size="small" slot="selection" />
          )}
        </Column>
      )}
      <Collection items={columns}>{children}</Collection>
    </TableHeaderPrimitive>
  );
};

interface TableRowProps<T extends object> extends RowProps<T> {
  ref?: React.Ref<HTMLTableRowElement>;
}

const TableRow = <T extends object>({
  children,
  className,
  columns,
  id,
  ref,
  ...props
}: TableRowProps<T>) => {
  const { selectionBehavior, allowsDragging } = useTableOptions();
  const { striped } = useTableContext();
  return (
    <Row
      ref={ref}
      data-slot="table-row"
      id={id}
      {...props}
      className={composeRenderProps(
        className,
        (
          className,
          {
            isSelected,
            selectionMode,
            isFocusVisibleWithin,
            isDragging,
            isDisabled,
            isFocusVisible,
          },
        ) =>
          twMerge(
            'group relative min-h-12 cursor-default text-black outline outline-transparent',
            isFocusVisible &&
              'bg-primary/5 ring-3 ring-ring/20 outline-primary hover:bg-primary/10',
            isDragging &&
              'cursor-grabbing bg-primary/10 text-fg outline-primary',
            isSelected &&
              'bg-(--table-selected-bg) text-fg hover:bg-(--table-selected-bg)/50',
            striped && 'even:bg-muted',
            (props.href || props.onAction || selectionMode === 'multiple') &&
              'hover:bg-(--table-selected-bg) hover:text-fg',
            (props.href || props.onAction || selectionMode === 'multiple') &&
              isFocusVisibleWithin &&
              'bg-(--table-selected-bg)/50 text-fg selected:bg-(--table-selected-bg)/50',
            isDisabled && 'opacity-50',
            className,
          ),
      )}
    >
      {allowsDragging && (
        <TableCell className="px-0">
          <Button
            slot="drag"
            className="grid place-content-center rounded-xs px-[calc(var(--gutter)/2)] outline-hidden focus-visible:ring focus-visible:ring-ring"
          >
            <svg
              aria-hidden
              data-slot="icon"
              xmlns="http://www.w3.org/2000/svg"
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-grip-vertical-icon lucide-grip-vertical"
            >
              <circle cx={9} cy={12} r={1} />
              <circle cx={9} cy={5} r={1} />
              <circle cx={9} cy={19} r={1} />
              <circle cx={15} cy={12} r={1} />
              <circle cx={15} cy={5} r={1} />
              <circle cx={15} cy={19} r={1} />
            </svg>
          </Button>
        </TableCell>
      )}
      {selectionBehavior === 'toggle' && (
        <TableCell className="px-0">
          <Checkbox size="small" slot="selection" />
        </TableCell>
      )}
      <Collection items={columns}>{children}</Collection>
    </Row>
  );
};

interface TableCellProps extends CellProps {
  ref?: React.Ref<HTMLTableCellElement>;
}
const TableCell = ({ className, ref, ...props }: TableCellProps) => {
  const { allowResize, bleed, grid, striped } = useTableContext();
  return (
    <Cell
      ref={ref}
      data-slot="table-cell"
      {...props}
      className={cx(
        twJoin(
          'group px-4 py-(--gutter-y) align-middle outline-hidden group-has-data-focus-visible-within:text-fg first:pl-(--gutter,--spacing(2)) last:pr-(--gutter,--spacing(2))',
          !striped && 'border-b',
          grid && 'border-l first:border-l-0',
          !bleed && 'sm:first:pl-1 sm:last:pr-1',
          allowResize && 'truncate overflow-hidden',
        ),
        className,
      )}
    />
  );
};

export type { TableProps, TableColumnProps, TableRowProps };
export { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow };
