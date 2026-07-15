import { Toggle } from '@op/sense/Toggle';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuBold, LuItalic } from 'react-icons/lu';

import { withSense } from './sense';

const meta: Meta<typeof Toggle> = {
  title: 'Sense/Toggle',
  component: Toggle,
  decorators: [withSense],
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
    <Toggle aria-label="Bold">
      <LuBold />
      Text
    </Toggle>
  ),
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Toggle aria-label="Bold">
        <LuBold />
        Text
      </Toggle>
      <Toggle variant="outline" aria-label="Bold">
        <LuBold />
        Text
      </Toggle>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Toggle variant="outline" size="sm" aria-label="Italic">
        <LuItalic />
        Small
      </Toggle>
      <Toggle variant="outline" size="default" aria-label="Italic">
        <LuItalic />
        Default
      </Toggle>
      <Toggle variant="outline" size="lg" aria-label="Italic">
        <LuItalic />
        Large
      </Toggle>
    </div>
  ),
};

export const Pressed: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Toggle defaultPressed aria-label="Bold">
        <LuBold />
        Text
      </Toggle>
      <Toggle variant="outline" defaultPressed aria-label="Bold">
        <LuBold />
        Text
      </Toggle>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Toggle disabled aria-label="Bold">
        <LuBold />
        Text
      </Toggle>
      <Toggle variant="outline" disabled aria-label="Bold">
        <LuBold />
        Text
      </Toggle>
    </div>
  ),
};
