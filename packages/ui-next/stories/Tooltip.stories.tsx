import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '@/components/Button';
import { Tooltip, TooltipTrigger } from '@/components/Tooltip';

const meta: Meta = {
  title: 'shadcn/Tooltip',
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const Basic: Story = {
  render: () => (
    <TooltipTrigger>
      <Button>Hover me</Button>
      <Tooltip>Hint text</Tooltip>
    </TooltipTrigger>
  ),
};

export const WithIconButton: Story = {
  render: () => (
    <TooltipTrigger>
      <Button size="small" variant="icon">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
        </svg>
      </Button>
      <Tooltip side="right">Settings</Tooltip>
    </TooltipTrigger>
  ),
};

export const Delays: Story = {
  render: () => (
    <TooltipTrigger delay={1000} closeDelay={100}>
      <Button>Slow tooltip</Button>
      <Tooltip>Appears after 1s</Tooltip>
    </TooltipTrigger>
  ),
};
