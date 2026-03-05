import type { Meta, StoryObj } from '@storybook/react';
import { LuTriangleAlert } from 'react-icons/lu';

import { AlertBanner } from '../src/components/AlertBanner';

const meta: Meta<typeof AlertBanner> = {
  title: 'AlertBanner',
  component: AlertBanner,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['warning', 'alert', 'neutral'],
    },
    children: {
      control: 'text',
    },
  },
};

export default meta;

type Story = StoryObj<typeof AlertBanner>;

export const Warning: Story = {
  args: {
    variant: 'warning',
    children: 'This action requires your attention before proceeding.',
  },
};

export const Alert: Story = {
  args: {
    variant: 'alert',
    children: 'There was a critical error processing your request.',
  },
};

export const Neutral: Story = {
  args: {
    variant: 'neutral',
    children: 'Your session will expire in 5 minutes.',
  },
};

export const CustomIcon: Story = {
  args: {
    variant: 'warning',
    icon: <LuTriangleAlert className="size-4" />,
    children: 'Warning with a custom triangle icon.',
  },
};

export const LongText: Story = {
  args: {
    variant: 'warning',
    children:
      'This is a very long message that should be truncated with an ellipsis when it overflows the container width. It keeps going and going to demonstrate the text-overflow behavior of the AlertBanner component.',
  },
};

export const AllVariants = () => (
  <div className="flex w-96 flex-col gap-4">
    <AlertBanner variant="warning">
      Warning: This action requires your attention.
    </AlertBanner>
    <AlertBanner variant="alert">
      Alert: There was a critical error processing your request.
    </AlertBanner>
    <AlertBanner variant="neutral">
      Info: Your session will expire in 5 minutes.
    </AlertBanner>
  </div>
);
