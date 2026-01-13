import type { Meta } from '@storybook/react-vite';
import { useMemo, useState } from 'react';
import type { SortDescriptor } from 'react-aria-components';

import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '../src/components/ui/table';

const meta: Meta<typeof Table> = {
  title: 'Intent UI/Table',
  component: Table,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;

const sampleData = [
  { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'Editor' },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'Viewer' },
  { id: 4, name: 'Alice Brown', email: 'alice@example.com', role: 'Editor' },
];

export const Default = () => (
  <Table aria-label="Users table">
    <TableHeader>
      <TableColumn isRowHeader>Name</TableColumn>
      <TableColumn>Email</TableColumn>
      <TableColumn>Role</TableColumn>
    </TableHeader>
    <TableBody>
      {sampleData.map((user) => (
        <TableRow key={user.id}>
          <TableCell>{user.name}</TableCell>
          <TableCell>{user.email}</TableCell>
          <TableCell>{user.role}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export const Striped = () => (
  <Table aria-label="Users table" striped>
    <TableHeader>
      <TableColumn isRowHeader>Name</TableColumn>
      <TableColumn>Email</TableColumn>
      <TableColumn>Role</TableColumn>
    </TableHeader>
    <TableBody>
      {sampleData.map((user) => (
        <TableRow key={user.id}>
          <TableCell>{user.name}</TableCell>
          <TableCell>{user.email}</TableCell>
          <TableCell>{user.role}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export const WithGrid = () => (
  <Table aria-label="Users table" grid>
    <TableHeader>
      <TableColumn isRowHeader>Name</TableColumn>
      <TableColumn>Email</TableColumn>
      <TableColumn>Role</TableColumn>
    </TableHeader>
    <TableBody>
      {sampleData.map((user) => (
        <TableRow key={user.id}>
          <TableCell>{user.name}</TableCell>
          <TableCell>{user.email}</TableCell>
          <TableCell>{user.role}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export const Selectable = () => (
  <Table aria-label="Users table" selectionMode="multiple">
    <TableHeader>
      <TableColumn isRowHeader>Name</TableColumn>
      <TableColumn>Email</TableColumn>
      <TableColumn>Role</TableColumn>
    </TableHeader>
    <TableBody>
      {sampleData.map((user) => (
        <TableRow key={user.id}>
          <TableCell>{user.name}</TableCell>
          <TableCell>{user.email}</TableCell>
          <TableCell>{user.role}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export const Sortable = () => {
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'name',
    direction: 'ascending',
  });

  const sortedData = useMemo(() => {
    return [...sampleData].sort((a, b) => {
      const column = sortDescriptor.column as keyof (typeof sampleData)[0];
      const aValue = a[column];
      const bValue = b[column];

      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      }

      return sortDescriptor.direction === 'descending'
        ? -comparison
        : comparison;
    });
  }, [sortDescriptor]);

  return (
    <Table
      aria-label="Users table"
      sortDescriptor={sortDescriptor}
      onSortChange={setSortDescriptor}
    >
      <TableHeader>
        <TableColumn id="name" isRowHeader allowsSorting>
          Name
        </TableColumn>
        <TableColumn id="email" allowsSorting>
          Email
        </TableColumn>
        <TableColumn id="role" allowsSorting>
          Role
        </TableColumn>
      </TableHeader>
      <TableBody>
        {sortedData.map((user) => (
          <TableRow key={user.id}>
            <TableCell>{user.name}</TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>{user.role}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export const Resizable = () => (
  <Table aria-label="Users table" allowResize>
    <TableHeader>
      <TableColumn isRowHeader isResizable>
        Name
      </TableColumn>
      <TableColumn isResizable>Email</TableColumn>
      <TableColumn isResizable>Role</TableColumn>
    </TableHeader>
    <TableBody>
      {sampleData.map((user) => (
        <TableRow key={user.id}>
          <TableCell>{user.name}</TableCell>
          <TableCell>{user.email}</TableCell>
          <TableCell>{user.role}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export const SingleSelection = () => (
  <Table aria-label="Users table" selectionMode="single">
    <TableHeader>
      <TableColumn isRowHeader>Name</TableColumn>
      <TableColumn>Email</TableColumn>
      <TableColumn>Role</TableColumn>
    </TableHeader>
    <TableBody>
      {sampleData.map((user) => (
        <TableRow key={user.id}>
          <TableCell>{user.name}</TableCell>
          <TableCell>{user.email}</TableCell>
          <TableCell>{user.role}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export const Empty = () => (
  <Table aria-label="Empty users table">
    <TableHeader>
      <TableColumn isRowHeader>Name</TableColumn>
      <TableColumn>Email</TableColumn>
      <TableColumn>Role</TableColumn>
    </TableHeader>
    <TableBody>
      {[].map(() => (
        <TableRow key="empty">
          <TableCell>-</TableCell>
          <TableCell>-</TableCell>
          <TableCell>-</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export const EmptyWithMessage = () => (
  <Table aria-label="Empty users table">
    <TableHeader>
      <TableColumn isRowHeader>Name</TableColumn>
      <TableColumn>Email</TableColumn>
      <TableColumn>Role</TableColumn>
    </TableHeader>
    <TableBody
      renderEmptyState={() => (
        <div className="p-4 text-center text-muted-fg">No users found</div>
      )}
    >
      {[]}
    </TableBody>
  </Table>
);

export const CombinedFeatures = () => {
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'name',
    direction: 'ascending',
  });

  const sortedData = useMemo(() => {
    return [...sampleData].sort((a, b) => {
      const column = sortDescriptor.column as keyof (typeof sampleData)[0];
      const aValue = a[column];
      const bValue = b[column];

      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      }

      return sortDescriptor.direction === 'descending'
        ? -comparison
        : comparison;
    });
  }, [sortDescriptor]);

  return (
    <Table
      aria-label="Users table"
      selectionMode="multiple"
      striped
      sortDescriptor={sortDescriptor}
      onSortChange={setSortDescriptor}
    >
      <TableHeader>
        <TableColumn id="name" isRowHeader allowsSorting>
          Name
        </TableColumn>
        <TableColumn id="email" allowsSorting>
          Email
        </TableColumn>
        <TableColumn id="role" allowsSorting>
          Role
        </TableColumn>
      </TableHeader>
      <TableBody>
        {sortedData.map((user) => (
          <TableRow key={user.id}>
            <TableCell>{user.name}</TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>{user.role}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
