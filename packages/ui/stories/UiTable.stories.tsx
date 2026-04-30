import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../src/components/ui/table';

const meta: Meta<typeof Table> = {
  title: 'Components/ui/Table',
  component: Table,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
};

export default meta;

const sample = [
  { id: 'INV-001', status: 'Paid', method: 'Card', total: '$250.00' },
  { id: 'INV-002', status: 'Pending', method: 'Wire', total: '$150.00' },
  { id: 'INV-003', status: 'Unpaid', method: 'Cash', total: '$350.00' },
];

export const Default: StoryObj = {
  render: () => (
    <Table>
      <TableCaption>A list of recent invoices.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-32">Invoice</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Method</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sample.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">{row.id}</TableCell>
            <TableCell>{row.status}</TableCell>
            <TableCell>{row.method}</TableCell>
            <TableCell className="text-right">{row.total}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};
