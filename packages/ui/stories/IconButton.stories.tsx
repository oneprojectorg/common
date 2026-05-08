import type { Meta, StoryObj } from '@storybook/react-vite';

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
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-center gap-2">
        <span className="text-sm font-medium">Ghost</span>
        <IconButton variant="ghost" aria-label="Ghost variant">
          <DummyIcon />
        </IconButton>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-sm font-medium">Solid</span>
        <IconButton variant="solid" aria-label="Solid variant">
          <DummyIcon />
        </IconButton>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-sm font-medium">Outline</span>
        <IconButton variant="outline" aria-label="Outline variant">
          <DummyIcon />
        </IconButton>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-sm font-medium">Disabled</span>
        <IconButton isDisabled aria-label="Disabled variant">
          <DummyIcon />
        </IconButton>
      </div>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-center gap-2">
        <span className="text-sm font-medium">Small</span>
        <IconButton size="small" aria-label="Small size">
          <DummyIcon />
        </IconButton>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-sm font-medium">Medium</span>
        <IconButton size="medium" aria-label="Medium size">
          <DummyIcon />
        </IconButton>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-sm font-medium">Large</span>
        <IconButton size="large" aria-label="Large size">
          <DummyIcon />
        </IconButton>
      </div>
    </div>
  ),
};
