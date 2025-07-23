import type { Meta, StoryObj } from '@storybook/react';

import { IconButton } from '../src/components/IconButton';

const meta: Meta<typeof IconButton> = {
  title: 'Components/IconButton',
  component: IconButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['small', 'medium', 'large'],
    },
    variant: {
      control: { type: 'select' },
      options: ['ghost', 'solid', 'outline'],
    },
    isDisabled: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const DummyIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="8" cy="4" r="1" fill="currentColor" />
    <circle cx="8" cy="8" r="1" fill="currentColor" />
    <circle cx="8" cy="12" r="1" fill="currentColor" />
  </svg>
);

export const Default: Story = {
  args: {
    children: <DummyIcon />,
  },
};

export const Small: Story = {
  args: {
    size: 'small',
    children: <DummyIcon />,
  },
};

export const Medium: Story = {
  args: {
    size: 'medium',
    children: <DummyIcon />,
  },
};

export const Large: Story = {
  args: {
    size: 'large',
    children: <DummyIcon />,
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: <DummyIcon />,
  },
};

export const Solid: Story = {
  args: {
    variant: 'solid',
    children: <DummyIcon />,
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: <DummyIcon />,
  },
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
    children: <DummyIcon />,
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-4 items-center">
      <div className="flex flex-col gap-2 items-center">
        <span className="text-sm font-medium">Ghost</span>
        <IconButton variant="ghost">
          <DummyIcon />
        </IconButton>
      </div>
      <div className="flex flex-col gap-2 items-center">
        <span className="text-sm font-medium">Solid</span>
        <IconButton variant="solid">
          <DummyIcon />
        </IconButton>
      </div>
      <div className="flex flex-col gap-2 items-center">
        <span className="text-sm font-medium">Outline</span>
        <IconButton variant="outline">
          <DummyIcon />
        </IconButton>
      </div>
      <div className="flex flex-col gap-2 items-center">
        <span className="text-sm font-medium">Disabled</span>
        <IconButton isDisabled>
          <DummyIcon />
        </IconButton>
      </div>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex gap-4 items-center">
      <div className="flex flex-col gap-2 items-center">
        <span className="text-sm font-medium">Small</span>
        <IconButton size="small">
          <DummyIcon />
        </IconButton>
      </div>
      <div className="flex flex-col gap-2 items-center">
        <span className="text-sm font-medium">Medium</span>
        <IconButton size="medium">
          <DummyIcon />
        </IconButton>
      </div>
      <div className="flex flex-col gap-2 items-center">
        <span className="text-sm font-medium">Large</span>
        <IconButton size="large">
          <DummyIcon />
        </IconButton>
      </div>
    </div>
  ),
};