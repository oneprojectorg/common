import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuPencil } from 'react-icons/lu';

import { IconButton } from '@/components/IconButton';
import { LoadingSpinner } from '@/components/LoadingSpinner';

const meta = {
  title: 'shadcn/IconButton',
  component: IconButton,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <IconButton size="small" aria-label="Edit">
        <LuPencil />
      </IconButton>
      <IconButton size="medium" aria-label="Edit">
        <LuPencil />
      </IconButton>
      <IconButton size="large" aria-label="Edit">
        <LuPencil />
      </IconButton>
    </div>
  ),
  tags: ['autodocs'],
};

export const Variants: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <IconButton variant="ghost" aria-label="Edit">
        <LuPencil />
      </IconButton>
      <IconButton variant="solid" aria-label="Edit">
        <LuPencil />
      </IconButton>
      <IconButton variant="outline" aria-label="Edit">
        <LuPencil />
      </IconButton>
    </div>
  ),
};

export const Spinner: Story = {
  name: 'LoadingSpinner alongside',
  render: () => (
    <div className="flex items-center gap-3">
      <LoadingSpinner color="teal" />
      <LoadingSpinner color="gray" />
    </div>
  ),
};
