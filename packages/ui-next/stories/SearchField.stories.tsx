import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { SearchField } from '@/components/SearchField';

const meta: Meta<typeof SearchField> = {
  title: 'shadcn/SearchField',
  component: SearchField,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SearchField>;

export const Default: Story = {
  args: { label: 'Search', placeholder: 'Search…' },
};

export const Controlled: Story = {
  render: () => {
    const [v, setV] = useState('hello');
    return <SearchField label="Search" value={v} onChange={setV} />;
  },
};

export const WithError: Story = {
  args: {
    label: 'Search',
    placeholder: 'Search…',
    errorMessage: 'No results',
  },
};
