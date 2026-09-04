import { Kbd, KbdGroup } from '@op/sense/Kbd';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Kbd> = {
  title: 'Primitives/Kbd',
  component: Kbd,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Kbd>;

export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Kbd>⌘</Kbd>
      <Kbd>⇧</Kbd>
      <Kbd>⌥</Kbd>
      <Kbd>Esc</Kbd>
    </div>
  ),
};

export const Group: Story = {
  render: () => (
    <KbdGroup>
      <Kbd>Ctrl</Kbd>
      <span className="text-xs text-muted-foreground">+</span>
      <Kbd>B</Kbd>
    </KbdGroup>
  ),
};

export const InText: Story = {
  render: () => (
    <p className="text-sm">
      Press{' '}
      <KbdGroup>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>{' '}
      to open the command palette.
    </p>
  ),
};
