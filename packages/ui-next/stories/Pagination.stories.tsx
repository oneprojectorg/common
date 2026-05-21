import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Pagination } from '@/components/Pagination';

const meta: Meta<typeof Pagination> = {
  title: 'shadcn/Pagination',
  component: Pagination,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[36rem]">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Pagination>;

export const NavOnly: Story = {
  render: () => {
    const [page, setPage] = useState(0);
    return (
      <Pagination
        next={() => setPage((p) => p + 1)}
        previous={page > 0 ? () => setPage((p) => p - 1) : undefined}
      />
    );
  },
};

export const WithRange: Story = {
  render: () => {
    const [page, setPage] = useState(0);
    return (
      <Pagination
        range={{ totalItems: 100, itemsPerPage: 10, page, label: 'users' }}
        next={page < 9 ? () => setPage((p) => p + 1) : undefined}
        previous={page > 0 ? () => setPage((p) => p - 1) : undefined}
      />
    );
  },
};

export const Disabled: Story = {
  render: () => (
    <Pagination
      range={{ totalItems: 5, itemsPerPage: 10, page: 0 }}
      next={undefined}
      previous={undefined}
    />
  ),
};
