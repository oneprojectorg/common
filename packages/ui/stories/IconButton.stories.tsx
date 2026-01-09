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
    <div className="gap-4 flex items-center">
      <div className="gap-2 flex flex-col items-center">
        <span className="font-medium text-sm">Ghost</span>
        <IconButton variant="ghost">
          <DummyIcon />
        </IconButton>
      </div>
      <div className="gap-2 flex flex-col items-center">
        <span className="font-medium text-sm">Solid</span>
        <IconButton variant="solid">
          <DummyIcon />
        </IconButton>
      </div>
      <div className="gap-2 flex flex-col items-center">
        <span className="font-medium text-sm">Outline</span>
        <IconButton variant="outline">
          <DummyIcon />
        </IconButton>
      </div>
      <div className="gap-2 flex flex-col items-center">
        <span className="font-medium text-sm">Disabled</span>
        <IconButton isDisabled>
          <DummyIcon />
        </IconButton>
      </div>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="gap-4 flex items-center">
      <div className="gap-2 flex flex-col items-center">
        <span className="font-medium text-sm">Small</span>
        <IconButton size="small">
          <DummyIcon />
        </IconButton>
      </div>
      <div className="gap-2 flex flex-col items-center">
        <span className="font-medium text-sm">Medium</span>
        <IconButton size="medium">
          <DummyIcon />
        </IconButton>
      </div>
      <div className="gap-2 flex flex-col items-center">
        <span className="font-medium text-sm">Large</span>
        <IconButton size="large">
          <DummyIcon />
        </IconButton>
      </div>
    </div>
  ),
};
