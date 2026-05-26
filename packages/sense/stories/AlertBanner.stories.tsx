import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuCircleAlert } from 'react-icons/lu';

import { AlertBanner } from '@/components/AlertBanner';

const meta: Meta<typeof AlertBanner> = {
  title: 'shadcn/AlertBanner',
  component: AlertBanner,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[36rem]">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AlertBanner>;

export const Info: Story = {
  args: {
    intent: 'info',
    children: 'Heads up — a piece of information for context.',
  },
};

export const Warning: Story = {
  args: {
    intent: 'warning',
    children: 'Something needs your attention.',
  },
};

export const Danger: Story = {
  args: {
    intent: 'danger',
    children: 'A destructive thing happened.',
  },
};

export const Success: Story = {
  args: {
    intent: 'success',
    children: 'You did it.',
  },
};

export const Banner: Story = {
  args: {
    variant: 'banner',
    intent: 'warning',
    icon: <LuCircleAlert className="size-4" />,
    children: 'Banner variant — compact single-line note.',
  },
};

export const NoIndicator: Story = {
  args: {
    intent: 'info',
    indicator: false,
    children: 'Indicator off.',
  },
};

export const FullWidth: Story = {
  args: {
    intent: 'warning',
    variant: 'banner',
    fullWidth: true,
    children: 'Full-width banner (no side borders / corners).',
  },
};
