import { HorizontalList, HorizontalListItem } from '@op/sense/HorizontalList';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof HorizontalList> = {
  title: 'Composites/HorizontalList',
  component: HorizontalList,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof HorizontalList>;

// Snap-scrolling strip; the scrollbar is hidden (no-scrollbar utility).
export const Default: Story = {
  render: () => (
    <HorizontalList className="max-w-md">
      {Array.from({ length: 10 }, (_, i) => (
        <HorizontalListItem key={i}>
          <div className="flex h-24 w-40 items-center justify-center rounded-lg border bg-muted text-title">
            {i + 1}
          </div>
        </HorizontalListItem>
      ))}
    </HorizontalList>
  ),
};
