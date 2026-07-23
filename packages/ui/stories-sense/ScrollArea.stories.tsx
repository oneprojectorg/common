import { ScrollArea } from '@op/sense/ScrollArea';
import { Separator } from '@op/sense/Separator';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof ScrollArea> = {
  title: 'Sense/Primitives/ScrollArea',
  component: ScrollArea,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof ScrollArea>;

const tags = Array.from({ length: 20 }, (_, i) => `v1.2.0-beta.${50 - i}`);

export const Default: Story = {
  render: () => (
    <ScrollArea className="h-72 w-48 rounded-lg border bg-background">
      <div className="p-4">
        <p className="pb-4 text-sm font-strong">Tags</p>
        {tags.map((tag, i) => (
          <div key={tag}>
            <p className="text-sm">{tag}</p>
            {i < tags.length - 1 && <Separator className="my-2" />}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};
