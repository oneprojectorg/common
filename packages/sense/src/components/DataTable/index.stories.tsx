import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import {
  DataTable,
  DataTableColumnHeader,
  createDataTableColumns,
  dataTableSelectColumn,
  type DataTableColumnDef,
} from '@op/sense/DataTable';
import { DirectionProvider } from '@op/sense/Direction';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuEllipsis } from 'react-icons/lu';

interface Payment {
  id: string;
  amount: number;
  status: 'pending' | 'processing' | 'success' | 'failed';
  email: string;
}

const payments: Payment[] = [
  {
    id: 'm5gr84i9',
    amount: 316,
    status: 'success',
    email: 'ken99@example.com',
  },
  {
    id: '3u1reuv4',
    amount: 242,
    status: 'success',
    email: 'abe45@example.com',
  },
  {
    id: 'derv1ws0',
    amount: 837,
    status: 'processing',
    email: 'monserrat44@example.com',
  },
  {
    id: '5kma53ae',
    amount: 874,
    status: 'success',
    email: 'silas22@example.com',
  },
  {
    id: 'bhqecj4p',
    amount: 721,
    status: 'failed',
    email: 'carmella@example.com',
  },
  {
    id: 'p0r8sd2k',
    amount: 150,
    status: 'pending',
    email: 'nadia@example.com',
  },
  {
    id: 'x7t2mq9w',
    amount: 498,
    status: 'processing',
    email: 'omar.f@example.com',
  },
  { id: 'c4l9vn1e', amount: 60, status: 'success', email: 'lea.m@example.com' },
  {
    id: 'j2h6ty8u',
    amount: 1210,
    status: 'pending',
    email: 'tomas@example.com',
  },
  { id: 'q9w3er5t', amount: 333, status: 'failed', email: 'priya@example.com' },
  {
    id: 'z8x7c6v5',
    amount: 905,
    status: 'success',
    email: 'yusuf@example.com',
  },
  {
    id: 'b1n2m3k4',
    amount: 47,
    status: 'processing',
    email: 'ines@example.com',
  },
];

const STATUS_VARIANT = {
  pending: 'secondary',
  processing: 'accent',
  success: 'default',
  failed: 'destructive',
} as const;

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const column = createDataTableColumns<Payment>();

const columns: DataTableColumnDef<Payment>[] = column.columns([
  dataTableSelectColumn<Payment>(),
  column.accessor('status', {
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={STATUS_VARIANT[row.original.status]}>
        {row.original.status}
      </Badge>
    ),
  }),
  column.accessor('email', {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
  }),
  column.accessor('amount', {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Amount"
        className="justify-end"
      />
    ),
    cell: ({ row }) => (
      <div className="text-end tabular-nums">
        {money.format(row.original.amount)}
      </div>
    ),
  }),
  column.display({
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Open menu" />
          }
        >
          <LuEllipsis aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(row.original.id)}
            >
              Copy payment ID
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem>View customer</DropdownMenuItem>
          <DropdownMenuItem>View payment details</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  }),
]);

const meta: Meta<typeof DataTable<Payment>> = {
  title: 'Composites/DataTable',
  component: DataTable<Payment>,
  tags: ['autodocs'],
  args: {
    columns,
    data: payments,
    filterColumn: 'email',
    copy: { filterLabel: 'Filter emails', filterPlaceholder: 'Filter emails…' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { data: [] },
};

export const WithoutToolbar: Story = {
  args: { filterColumn: undefined, showViewOptions: false, pageSize: 5 },
};

export const RightToLeft: Story = {
  render: (args) => (
    <DirectionProvider direction="rtl">
      <div dir="rtl">
        <DataTable {...args} />
      </div>
    </DirectionProvider>
  ),
};
