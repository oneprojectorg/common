import type { Meta, StoryObj } from '@storybook/react-vite';

import { Breadcrumb, Breadcrumbs } from '@/components/Breadcrumbs';

const meta: Meta<typeof Breadcrumbs> = {
  title: 'shadcn/Breadcrumbs',
  component: Breadcrumbs,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Breadcrumbs>;

export const Default: Story = {
  render: () => (
    <Breadcrumbs>
      <Breadcrumb href="/org/acme">Acme Org</Breadcrumb>
      <Breadcrumb>Relationships</Breadcrumb>
    </Breadcrumbs>
  ),
};

export const Single: Story = {
  render: () => (
    <Breadcrumbs>
      <Breadcrumb>Settings</Breadcrumb>
    </Breadcrumbs>
  ),
};

export const Deep: Story = {
  render: () => (
    <Breadcrumbs>
      <Breadcrumb href="/">Home</Breadcrumb>
      <Breadcrumb href="/org">Organizations</Breadcrumb>
      <Breadcrumb href="/org/acme">Acme Org</Breadcrumb>
      <Breadcrumb>Members</Breadcrumb>
    </Breadcrumbs>
  ),
};
