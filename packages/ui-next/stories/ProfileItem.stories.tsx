import type { Meta, StoryObj } from '@storybook/react-vite';

import { Avatar } from '@/components/Avatar';
import { ProfileItem } from '@/components/ProfileItem';

const meta: Meta<typeof ProfileItem> = {
  title: 'shadcn/ProfileItem',
  component: ProfileItem,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[28rem]">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ProfileItem>;

export const Default: Story = {
  render: () => (
    <ProfileItem
      avatar={<Avatar placeholder="Jane Doe" />}
      title="Jane Doe"
      description="Steward at Acme Co-op"
    />
  ),
};

export const TitleOnly: Story = {
  render: () => (
    <ProfileItem avatar={<Avatar placeholder="Solo Org" />} title="Solo Org" />
  ),
};

export const Small: Story = {
  render: () => (
    <ProfileItem
      size="small"
      avatar={<Avatar placeholder="Compact" size="sm" />}
      title="Compact row"
      description="Smaller text variant"
    />
  ),
};

export const WithChildren: Story = {
  render: () => (
    <ProfileItem
      avatar={<Avatar placeholder="Long Bio" />}
      title="Long Bio"
      description="Maintainer of OP cooperative tooling"
    >
      <button type="button" className="text-sm text-primary hover:underline">
        View profile
      </button>
    </ProfileItem>
  ),
};
