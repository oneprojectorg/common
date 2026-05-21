import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { LuX } from 'react-icons/lu';

import { Tag, TagGroup } from '@/components/TagGroup';

const meta: Meta<typeof TagGroup> = {
  title: 'shadcn/TagGroup',
  component: TagGroup,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[28rem]">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TagGroup>;

export const Default: Story = {
  render: () => (
    <TagGroup>
      <Tag>Admin</Tag>
      <Tag>Member</Tag>
      <Tag>Steward</Tag>
    </TagGroup>
  ),
};

export const Removable: Story = {
  render: () => {
    const [items, setItems] = useState(['Apple', 'Banana', 'Cherry']);
    return (
      <TagGroup aria-label="Fruit">
        {items.map((t) => (
          <Tag key={t}>
            {t}
            <button
              type="button"
              onClick={() => setItems((xs) => xs.filter((x) => x !== t))}
            >
              <LuX className="size-3" />
            </button>
          </Tag>
        ))}
      </TagGroup>
    );
  },
};
