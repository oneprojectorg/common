import { PaginationBar } from '@op/sense/PaginationBar';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

const meta: Meta<typeof PaginationBar> = {
  title: 'Composites/PaginationBar',
  component: PaginationBar,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof PaginationBar>;

// A callback left `undefined` disables its control — there is no separate
// `disabled` prop to keep in sync with whether the page exists.
export const Default: Story = {
  args: {
    range: { totalItems: 96, itemsPerPage: 10, page: 2, label: 'users' },
    next: () => {},
    previous: () => {},
  },
};

export const FirstPage: Story = {
  args: {
    range: { totalItems: 96, itemsPerPage: 10, page: 0, label: 'users' },
    next: () => {},
  },
};

export const LastPage: Story = {
  args: {
    range: { totalItems: 96, itemsPerPage: 10, page: 9, label: 'users' },
    previous: () => {},
  },
};

// No `range` means no readout — just the controls.
export const ControlsOnly: Story = {
  args: {
    next: () => {},
    previous: () => {},
  },
};

// The package is i18n-agnostic: every string is a prop. In the app, pass
// `t('…')` values for `renderRange`, `previousLabel`, `nextLabel`, and
// `navLabel` rather than relying on the English defaults.
export const TranslatedCopy: Story = {
  args: {
    range: { totalItems: 96, itemsPerPage: 10, page: 2 },
    next: () => {},
    previous: () => {},
    previousLabel: 'Précédent',
    nextLabel: 'Suivant',
    navLabel: 'Navigation par pages',
    renderRange: ({ start, end, total }) =>
      `${start} à ${end} sur ${total} personnes`,
  },
};

export const Interactive: Story = {
  render: () => <Pager />,
};

const Pager = () => {
  const totalItems = 96;
  const itemsPerPage = 10;
  const lastPage = Math.ceil(totalItems / itemsPerPage) - 1;
  const [page, setPage] = useState(0);

  return (
    <PaginationBar
      range={{ totalItems, itemsPerPage, page, label: 'users' }}
      previous={page > 0 ? () => setPage((p) => p - 1) : undefined}
      next={page < lastPage ? () => setPage((p) => p + 1) : undefined}
    />
  );
};
