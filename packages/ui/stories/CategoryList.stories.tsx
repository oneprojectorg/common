import type { Meta } from '@storybook/react';
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
      initialCategories={['Budget', 'Policies', 'Board of Directors']}
    />
  );
};

export const Controlled = () => {
  const [categories, setCategories] = useState<string[]>([]);

  return (
    <div className="space-y-4">
      <CategoryList
        className="w-96"
        initialCategories={categories}
        onUpdateList={setCategories}
      />
      <div className="text-sm text-neutral-gray4">
        <strong>Current categories:</strong> {categories.join(', ')}
      </div>
    </div>
  );
};
