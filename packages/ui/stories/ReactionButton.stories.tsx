import type { Meta, StoryObj } from '@storybook/react';
import { ReactionButton } from '../src/components/ReactionButton';

const meta: Meta<typeof ReactionButton> = {
  title: 'Components/ReactionButton',
  component: ReactionButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'hover', 'pressed', 'focus'],
    },
    isDisabled: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variant: 'default',
  },
};

export const Hover: Story = {
  args: {
    variant: 'hover',
  },
};

export const Pressed: Story = {
  args: {
    variant: 'pressed',
  },
};

export const Focus: Story = {
  args: {
    variant: 'focus',
  },
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-4">
      <ReactionButton variant="default" />
      <ReactionButton variant="hover" />
      <ReactionButton variant="pressed" />
      <ReactionButton variant="focus" />
      <ReactionButton isDisabled />
    </div>
  ),
};