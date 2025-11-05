import { useState } from 'react';

import { Pagination } from '../src/components/Pagination';

export default {
  title: 'Pagination',
  component: Pagination,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export const Default = () => {
  const [page, setPage] = useState(0);
  const totalItems = 100;
  const itemsPerPage = 10;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return (
    <Pagination
      range={{
        totalItems,
        itemsPerPage,
        page,
      }}
      next={page < totalPages - 1 ? () => setPage(page + 1) : undefined}
      previous={page > 0 ? () => setPage(page - 1) : undefined}
    />
  );
};

export const NavigationOnly = () => {
  const [page, setPage] = useState(0);
  const totalPages = 5;

  return (
    <Pagination
      next={page < totalPages - 1 ? () => setPage(page + 1) : undefined}
      previous={page > 0 ? () => setPage(page - 1) : undefined}
    />
  );
};

export const WithCustomLabel = () => {
  const [page, setPage] = useState(0);
  const totalItems = 250;
  const itemsPerPage = 25;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return (
    <Pagination
      range={{
        totalItems,
        itemsPerPage,
        page,
        label: 'results',
      }}
      next={page < totalPages - 1 ? () => setPage(page + 1) : undefined}
      previous={page > 0 ? () => setPage(page - 1) : undefined}
    />
  );
};
