import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button, ButtonLink } from '@/components/Button';

const meta = {
  title: 'shadcn/ButtonCompat',
  component: Button,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LegacyColors: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button color="primary">Primary</Button>
      <Button color="secondary">Secondary</Button>
      <Button color="neutral">Neutral</Button>
      <Button color="destructive">Destructive</Button>
      <Button color="ghost">Ghost</Button>
      <Button color="gradient">Gradient</Button>
      <Button color="unverified">Unverified</Button>
      <Button color="verified">Verified</Button>
    </div>
  ),
};

export const LegacySizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="small">Small</Button>
      <Button size="medium">Medium</Button>
      <Button size="inline">Inline</Button>
    </div>
  ),
};

export const VariantPill: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button variant="pill">Pill</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

export const Loading: Story = {
  args: { isLoading: true, children: 'Loading' },
};

export const Disabled: Story = {
  args: { isDisabled: true, children: 'Disabled' },
};

export const Link: Story = {
  render: () => (
    <ButtonLink href="https://example.com" target="_blank" rel="noreferrer">
      Open link
    </ButtonLink>
  ),
};
