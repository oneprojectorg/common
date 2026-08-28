import { Avatar, AvatarFallback } from '@op/sense/Avatar';
import { ProfileItem } from '@op/sense/ProfileItem';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof ProfileItem> = {
  title: 'Composites/ProfileItem',
  component: ProfileItem,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof ProfileItem>;

const avatar = (
  <Avatar>
    <AvatarFallback name="Frida Kahlo" />
  </Avatar>
);

export const Default: Story = {
  render: () => (
    <div className="w-80">
      <ProfileItem
        avatar={avatar}
        title="Frida Kahlo"
        description="Painter · Coyoacán"
      />
    </div>
  ),
};

export const TitleOnly: Story = {
  render: () => (
    <div className="w-80">
      <ProfileItem avatar={avatar} title="Frida Kahlo" />
    </div>
  ),
};

/**
 * The avatar is vertically centered against the whole text block — the
 * design contract that matters in table cells, where the row grows with
 * extra lines (here via `children`).
 */
export const CenterAlignment: Story = {
  render: () => (
    <div className="w-80">
      <ProfileItem
        avatar={avatar}
        title="Frida Kahlo"
        description="Painter · Coyoacán"
      >
        <span className="text-sm text-muted-foreground">
          Invited 2 days ago
        </span>
      </ProfileItem>
    </div>
  ),
};

export const Small: Story = {
  render: () => (
    <div className="w-80">
      <ProfileItem
        avatar={avatar}
        size="small"
        title="Frida Kahlo"
        description="Invited 2 days ago"
      />
    </div>
  ),
};
