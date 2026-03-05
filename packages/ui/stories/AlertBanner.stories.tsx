import type { Meta, StoryObj } from '@storybook/react';
import { LuTriangleAlert } from 'react-icons/lu';

import { AlertBanner } from '../src/components/AlertBanner';

const meta: Meta<typeof AlertBanner> = {
  title: 'AlertBanner',
  component: AlertBanner,
  tags: ['autodocs'],
  args: {
    variant: 'banner',
  },
  argTypes: {
    intent: {
      control: 'select',
      options: ['default', 'info', 'warning', 'danger', 'success'],
    },
    variant: {
      control: 'select',
      options: ['default', 'banner'],
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
    intent: 'warning',
    children: 'This action requires your attention before proceeding.',
  },
};

export const Alert: Story = {
  args: {
    intent: 'danger',
    children: 'There was a critical error processing your request.',
  },
};

export const Neutral: Story = {
  args: {
    intent: 'default',
    children: 'Your session will expire in 5 minutes.',
  },
};

export const CustomIcon: Story = {
  args: {
    intent: 'warning',
    icon: <LuTriangleAlert className="size-4" />,
    children: 'Warning with a custom triangle icon.',
  },
};

export const LongText: Story = {
  args: {
    intent: 'warning',
    children:
      'This is a very long message that should be truncated with an ellipsis when it overflows the container width. It keeps going and going to demonstrate the text-overflow behavior of the AlertBanner component.',
  },
};

export const BannerVariants = () => (
  <div className="flex w-96 flex-col gap-4">
    <AlertBanner variant="banner" intent="warning">
      Warning: This action requires your attention.
    </AlertBanner>
    <AlertBanner variant="banner" intent="danger">
      Alert: There was a critical error processing your request.
    </AlertBanner>
    <AlertBanner variant="banner" intent="default">
      Info: Your session will expire in 5 minutes.
    </AlertBanner>
  </div>
);

export const DefaultVariant: Story = {
  args: {
    variant: 'default',
    intent: 'warning',
    children: 'This uses the default AlertBanner styling with indicator.',
  },
};
