import { Separator } from '@op/sense/Separator';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Separator> = {
  title: 'Primitives/Separator',
  component: Separator,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Separator>;

export const Default: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-strong">Common Sense</p>
        <p className="text-sm text-muted-foreground">
          The foundation for your design system
        </p>
      </div>
      <Separator />
      <p className="text-sm">
        A set of beautifully designed components that you can customize, extend,
        and build on.
      </p>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-5 items-center gap-4 text-sm">
      <span>Blog</span>
      <Separator orientation="vertical" />
      <span>Docs</span>
      <Separator orientation="vertical" />
      <span>Source</span>
    </div>
  ),
};
