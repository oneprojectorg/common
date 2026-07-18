import { Toggle } from '@op/sense/Toggle';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuBold, LuItalic } from 'react-icons/lu';

import { withSense } from './sense';

const meta: Meta<typeof Toggle> = {
  title: 'Sense/Primitives/Toggle',
  component: Toggle,
  decorators: [withSense],
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
  },
};

export default meta;

type Story = StoryObj<typeof Toggle>;

export const Default: Story = {
  render: () => (
    <Toggle>
      <LuBold />
      Text
    </Toggle>
  ),
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Toggle>
        <LuBold />
        Text
      </Toggle>
      <Toggle variant="outline">
        <LuBold />
        Text
      </Toggle>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Toggle variant="outline" size="sm">
        <LuItalic />
        Small
      </Toggle>
      <Toggle variant="outline" size="default">
        <LuItalic />
        Default
      </Toggle>
      <Toggle variant="outline" size="lg">
        <LuItalic />
        Large
      </Toggle>
    </div>
  ),
};

export const Pressed: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Toggle defaultPressed>
        <LuBold />
        Text
      </Toggle>
      <Toggle variant="outline" defaultPressed>
        <LuBold />
        Text
      </Toggle>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Toggle disabled>
        <LuBold />
        Text
      </Toggle>
      <Toggle variant="outline" disabled>
        <LuBold />
        Text
      </Toggle>
    </div>
  ),
};
