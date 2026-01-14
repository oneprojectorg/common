import type { Meta } from '@storybook/react-vite';
import { useState } from 'react';

import { CategoryList } from '../src/components/CategoryList';

const meta: Meta<typeof CategoryList> = {
  component: CategoryList,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    onUpdateList: { action: 'onUpdateList' },
  },
};

export default meta;

export const EmptyState = () => {
  return <CategoryList className="w-96" />;
};

export const WithInitialCategories = () => {
  return (
    <CategoryList
      className="w-96"
      initialCategories={[
        { id: 'budget', label: 'Budget' },
        { id: 'policies', label: 'Policies' },
        { id: 'board', label: 'Board of Directors' },
      ]}
    />
  );
};

export const Controlled = () => {
  const [categories, setCategories] = useState<
    Array<{ id: string; label: string }>
  >([]);

  return (
    <div className="space-y-4">
      <CategoryList
        className="w-96"
        initialCategories={categories}
        onUpdateList={setCategories}
      />
      <div className="text-sm text-neutral-gray4">
        <strong>Current categories:</strong>{' '}
        {categories.map((c) => c.label).join(', ')}
      </div>
    </div>
  );
};
