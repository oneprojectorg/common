import { ToggleGroup, ToggleGroupItem } from '@op/sense/ToggleGroup';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  LuAlignCenter,
  LuAlignLeft,
  LuAlignRight,
  LuBold,
  LuItalic,
  LuUnderline,
} from 'react-icons/lu';

const meta: Meta<typeof ToggleGroup> = {
  title: 'Primitives/ToggleGroup',
  component: ToggleGroup,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'outline'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg'],
    },
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
    },
  },
};

export default meta;

type Story = StoryObj<typeof ToggleGroup>;

export const Default: Story = {
  render: () => (
    <ToggleGroup variant="outline" defaultValue={['bold']}>
      <ToggleGroupItem value="bold" aria-label="Bold">
        <LuBold />
      </ToggleGroupItem>
      <ToggleGroupItem value="italic" aria-label="Italic">
        <LuItalic />
      </ToggleGroupItem>
      <ToggleGroupItem value="underline" aria-label="Underline">
        <LuUnderline />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const Joined: Story = {
  render: () => (
    <ToggleGroup spacing={0} variant="outline" defaultValue={['bold']}>
      <ToggleGroupItem value="bold" aria-label="Bold">
        <LuBold />
      </ToggleGroupItem>
      <ToggleGroupItem value="italic" aria-label="Italic">
        <LuItalic />
      </ToggleGroupItem>
      <ToggleGroupItem value="underline" aria-label="Underline">
        <LuUnderline />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const Multiple: Story = {
  render: () => (
    <ToggleGroup multiple variant="outline" defaultValue={['bold', 'italic']}>
      <ToggleGroupItem value="bold" aria-label="Bold">
        <LuBold />
        Bold
      </ToggleGroupItem>
      <ToggleGroupItem value="italic" aria-label="Italic">
        <LuItalic />
        Italic
      </ToggleGroupItem>
      <ToggleGroupItem value="underline" aria-label="Underline">
        <LuUnderline />
        Underline
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-4">
      <ToggleGroup variant="outline" size="sm" defaultValue={['left']}>
        <AlignmentItems />
      </ToggleGroup>
      <ToggleGroup variant="outline" size="default" defaultValue={['left']}>
        <AlignmentItems />
      </ToggleGroup>
      <ToggleGroup variant="outline" size="lg" defaultValue={['left']}>
        <AlignmentItems />
      </ToggleGroup>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <ToggleGroup
      orientation="vertical"
      spacing={0}
      variant="outline"
      defaultValue={['left']}
    >
      <AlignmentItems />
    </ToggleGroup>
  ),
};

const AlignmentItems = () => (
  <>
    <ToggleGroupItem value="left" aria-label="Align left">
      <LuAlignLeft />
    </ToggleGroupItem>
    <ToggleGroupItem value="center" aria-label="Align center">
      <LuAlignCenter />
    </ToggleGroupItem>
    <ToggleGroupItem value="right" aria-label="Align right">
      <LuAlignRight />
    </ToggleGroupItem>
  </>
);
