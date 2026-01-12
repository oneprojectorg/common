import type { Meta } from '@storybook/react-vite';

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

export const Sortable = () => (
  <Table
    aria-label="Users table"
    sortDescriptor={{ column: 'name', direction: 'ascending' }}
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
    <TableBody renderEmptyState={() => <div className="p-4 text-center text-muted-fg">No users found</div>}>
      {[]}
    </TableBody>
  </Table>
);

export const CombinedFeatures = () => (
  <Table
    aria-label="Users table"
    selectionMode="multiple"
    striped
    sortDescriptor={{ column: 'name', direction: 'ascending' }}
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
