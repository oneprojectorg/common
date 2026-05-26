import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import {
  type ColumnDef,
  DataTable,
  type SortingState,
} from '@/components/DataTable';
import { Button } from '@/components/ui/button';

const meta: Meta<typeof DataTable> = {
  title: 'shadcn/DataTable',
  component: DataTable,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="w-full p-6">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DataTable>;

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member' | 'steward';
  joined: string;
}

const USERS: User[] = [
  {
    id: '1',
    name: 'Alex Rivera',
    email: 'alex@example.org',
    role: 'admin',
    joined: '2024-03-12',
  },
  {
    id: '2',
    name: 'Bea Chen',
    email: 'bea@example.org',
    role: 'member',
    joined: '2025-01-04',
  },
  {
    id: '3',
    name: 'Cy Okoye',
    email: 'cy@example.org',
    role: 'steward',
    joined: '2023-08-29',
  },
  {
    id: '4',
    name: 'Dani Park',
    email: 'dani@example.org',
    role: 'member',
    joined: '2025-06-18',
  },
];

const basicColumns: ColumnDef<User>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'role', header: 'Role' },
  { accessorKey: 'joined', header: 'Joined' },
];

export const Default: Story = {
  render: () => <DataTable columns={basicColumns} data={USERS} />,
};

const sortableColumns: ColumnDef<User>[] = [
  { accessorKey: 'name', header: 'Name', enableSorting: true },
  { accessorKey: 'email', header: 'Email', enableSorting: true },
  { accessorKey: 'role', header: 'Role', enableSorting: true },
  { accessorKey: 'joined', header: 'Joined', enableSorting: true },
];

export const Sortable: Story = {
  render: () => (
    <DataTable
      columns={sortableColumns}
      data={USERS}
      defaultSorting={[{ id: 'name', desc: false }]}
    />
  ),
};

export const ControlledSort: Story = {
  render: () => {
    const [sorting, setSorting] = useState<SortingState>([
      { id: 'joined', desc: true },
    ]);
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Sorting: {JSON.stringify(sorting)}
        </p>
        <DataTable
          columns={sortableColumns}
          data={USERS}
          sorting={sorting}
          onSortingChange={setSorting}
        />
      </div>
    );
  },
};

export const CustomCells: Story = {
  render: () => {
    const columns: ColumnDef<User>[] = [
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'email', header: 'Email' },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) => (
          <span className="rounded bg-muted px-2 py-0.5 text-xs">
            {row.original.role}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: () => (
          <Button variant="outline" size="sm">
            Edit
          </Button>
        ),
      },
    ];
    return <DataTable columns={columns} data={USERS} />;
  },
};

export const Empty: Story = {
  render: () => (
    <DataTable columns={basicColumns} data={[]} emptyState="No users yet." />
  ),
};
