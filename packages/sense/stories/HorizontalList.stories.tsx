import type { Meta, StoryObj } from '@storybook/react-vite';

import { HorizontalList } from '@/components/HorizontalList';

const meta: Meta<typeof HorizontalList> = {
  title: 'shadcn/HorizontalList',
  component: HorizontalList,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="w-full p-6">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof HorizontalList>;

export const Default: Story = {
  render: () => (
    <HorizontalList>
      {Array.from({ length: 12 }, (_, i) => (
        <div
          key={i}
          className="flex h-32 w-48 shrink-0 items-center justify-center rounded-lg bg-muted"
        >
          Item {i + 1}
        </div>
      ))}
    </HorizontalList>
  ),
};
