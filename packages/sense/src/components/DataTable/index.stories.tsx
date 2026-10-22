import { Button } from '@op/sense/Button';
import {
  DataTable,
  createDataTableColumns,
  type DataTableColumnDef,
} from '@op/sense/DataTable';
import { DirectionProvider } from '@op/sense/Direction';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { StatusBadge, type StatusBadgeProps } from '@op/sense/StatusBadge';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuEllipsis } from 'react-icons/lu';

interface Proposal {
  id: string;
  title: string;
  organization: string;
  status: keyof typeof STATUS;
  votes: number;
  updated: string;
}

const STATUS = {
  draft: { variant: 'inactive', label: 'Draft' },
  review: { variant: 'in-progress', label: 'In review' },
  revision: { variant: 'revision', label: 'Needs revision' },
  approved: { variant: 'success', label: 'Approved' },
  rejected: { variant: 'alert', label: 'Rejected' },
} satisfies Record<
  string,
  { variant: StatusBadgeProps['variant']; label: string }
>;

const proposals: Proposal[] = [
  {
    id: '1',
    title: 'Shared tool library for the east side',
    organization: 'Cully Neighbors Co-op',
    status: 'review',
    votes: 128,
    updated: '2026-10-21',
  },
  {
    id: '2',
    title: 'Participatory budget for the community kitchen',
    organization: 'Sunrise Collective',
    status: 'approved',
    votes: 342,
    updated: '2026-10-20',
  },
  {
    id: '3',
    title: 'Childcare cooperative pilot',
    organization: 'Lents Families',
    status: 'revision',
    votes: 57,
    updated: '2026-10-19',
  },
  {
    id: '4',
    title: 'Solar on the market roof',
    organization: 'People’s Market',
    status: 'review',
    votes: 211,
    updated: '2026-10-18',
  },
  {
    id: '5',
    title: 'Mutual aid fund rules, second draft',
    organization: 'Montavilla Mutual Aid',
    status: 'draft',
    votes: 0,
    updated: '2026-10-17',
  },
  {
    id: '6',
    title: 'Worker-owned bike delivery service',
    organization: 'Rose City Riders',
    status: 'approved',
    votes: 489,
    updated: '2026-10-15',
  },
  {
    id: '7',
    title: 'Land trust for the garden lots',
    organization: 'Growing Gardens',
    status: 'rejected',
    votes: 96,
    updated: '2026-10-12',
  },
  {
    id: '8',
    title: 'Open the print shop on weekends',
    organization: 'Independent Publishing',
    status: 'review',
    votes: 24,
    updated: '2026-10-11',
  },
  {
    id: '9',
    title: 'Translate the member handbook into Arabic',
    organization: 'New Roots',
    status: 'approved',
    votes: 160,
    updated: '2026-10-09',
  },
  {
    id: '10',
    title: 'Community-owned fiber for St. Johns',
    organization: 'St. Johns Connect',
    status: 'draft',
    votes: 8,
    updated: '2026-10-06',
  },
  {
    id: '11',
    title: 'Sliding-scale pricing at the tool library',
    organization: 'Cully Neighbors Co-op',
    status: 'revision',
    votes: 73,
    updated: '2026-10-03',
  },
  {
    id: '12',
    title: 'Youth council seats on the board',
    organization: 'Sunrise Collective',
    status: 'review',
    votes: 305,
    updated: '2026-09-30',
  },
];

const shortDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

const column = createDataTableColumns<Proposal>();

const columns: DataTableColumnDef<Proposal>[] = column.columns([
  column.accessor('title', {
    header: 'Proposal',
    cell: ({ row }) => (
      <div
        dir="auto"
        title={row.original.title}
        className="truncate ltr:text-left rtl:text-right"
      >
        {row.original.title}
      </div>
    ),
  }),
  column.accessor((row) => STATUS[row.status].label, {
    id: 'status',
    header: 'Status',
    meta: { width: 'w-44' },
    cell: ({ row }) => (
      <StatusBadge variant={STATUS[row.original.status].variant}>
        {STATUS[row.original.status].label}
      </StatusBadge>
    ),
  }),
  column.accessor('votes', {
    header: 'Votes',
    meta: { align: 'end', width: 'w-24' },
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.original.votes.toLocaleString('en-US')}
      </span>
    ),
  }),
  column.accessor('updated', {
    header: 'Updated',
    meta: { width: 'w-28' },
    sortDescFirst: true,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground">
        {shortDate.format(new Date(`${row.original.updated}T00:00:00`))}
      </span>
    ),
  }),
  column.display({
    id: 'actions',
    header: 'Actions',
    meta: { align: 'end', width: 'w-20' },
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`More actions for ${row.original.title}`}
            />
          }
        >
          <LuEllipsis aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>Open proposal</DropdownMenuItem>
          <DropdownMenuItem>Share link</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">
            Archive proposal
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  }),
]);

const meta: Meta<typeof DataTable<Proposal>> = {
  title: 'Composites/DataTable',
  component: DataTable<Proposal>,
  tags: ['autodocs'],
  args: {
    columns,
    data: proposals,
    getRowId: (row) => row.id,
    rowHeader: 'title',
    rowLabel: (row) => row.title,
    selectable: true,
    initialSorting: [{ id: 'updated', desc: true }],
    pageSize: 8,
    actions: <Button variant="outline">Export</Button>,
    selectionActions: () => (
      <>
        <Button variant="outline">Export selected</Button>
        <Button variant="outline">Archive selected</Button>
      </>
    ),
    copy: {
      searchLabel: 'Search proposals',
      searchPlaceholder: 'Search proposals',
      noResults: 'No proposals match',
      items: 'proposals',
      pagination: 'Proposals pages',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { initialSearch: 'bridge' },
};

export const Loading: Story = {
  args: { loading: true },
};

export const WithError: Story = {
  args: {
    error: 'Could not refresh proposals. Showing the last loaded list.',
  },
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
