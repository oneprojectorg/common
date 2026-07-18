import { AspectRatio } from '@op/sense/AspectRatio';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof AspectRatio> = {
  title: 'Sense/Primitives/AspectRatio',
  component: AspectRatio,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof AspectRatio>;

export const Default: Story = {
  render: () => (
    <div className="w-96">
      <AspectRatio ratio={16 / 9} className="rounded-lg bg-border">
        <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
          16 : 9
        </div>
      </AspectRatio>
    </div>
  ),
};

export const Square: Story = {
  render: () => (
    <div className="w-48">
      <AspectRatio ratio={1} className="rounded-lg bg-border">
        <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
          1 : 1
        </div>
      </AspectRatio>
    </div>
  ),
};
